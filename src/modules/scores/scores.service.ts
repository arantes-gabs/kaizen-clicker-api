import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Score } from '@prisma/client';
import { RateLimitExceededException } from '../../common/errors/rate-limit-exceeded.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AntiCheatService } from '../anti-cheat/anti-cheat.service';
import {
  DEFAULT_TOP_LIMIT,
  ImprovementLevels,
  MAX_TOP_LIMIT,
  RATE_LIMIT_WINDOW_SECONDS,
  createEmptyImprovementLevels,
  normalizeImprovementLevels,
} from '../anti-cheat/game-rules';
import { CreateScoreDto } from './dto/create-score.dto';
import {
  MeScoreResponse,
  SaveScoreResponse,
  TopScoreResponse,
} from './scores.types';

@Injectable()
export class ScoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly antiCheatService: AntiCheatService,
  ) {}

  async saveScore(dto: CreateScoreDto): Promise<SaveScoreResponse> {
    const storedResponse = await this.findStoredResponse(dto.requestId);

    if (storedResponse) {
      return storedResponse;
    }

    const antiCheat = this.antiCheatService.validateScore({
      score: dto.score,
      elapsedSeconds: dto.elapsedSeconds,
      improvements: dto.improvements,
    });

    const improvementsJson = JSON.stringify(antiCheat.improvements);
    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const repeatedRequest = await tx.saveRequest.findUnique({
          where: { requestId: dto.requestId },
        });

        if (repeatedRequest) {
          return this.parseStoredResponse(repeatedRequest.responseJson);
        }

        const currentScore = await tx.score.findUnique({
          where: { playerName: dto.playerName },
        });

        this.ensurePlayerCanSave(currentScore, now);

        const saved = !currentScore || dto.score > currentScore.score;
        const scoreRecord = currentScore
          ? await tx.score.update({
              where: { playerName: dto.playerName },
              data: saved
                ? {
                    score: dto.score,
                    improvementsJson,
                    elapsedSeconds: dto.elapsedSeconds,
                    lastSaveAt: now,
                  }
                : {
                    lastSaveAt: now,
                  },
            })
          : await tx.score.create({
              data: {
                playerName: dto.playerName,
                score: dto.score,
                improvementsJson,
                elapsedSeconds: dto.elapsedSeconds,
                lastSaveAt: now,
              },
            });

        const rank =
          (await tx.score.count({
            where: {
              score: {
                gt: scoreRecord.score,
              },
            },
          })) + 1;
        const response: SaveScoreResponse = {
          requestId: dto.requestId,
          playerName: scoreRecord.playerName,
          submittedScore: dto.score,
          bestScore: scoreRecord.score,
          saved,
          rank,
          improvements: antiCheat.improvements,
          theoreticalMaxScore: antiCheat.theoreticalMaxScore,
          acceptedMaxScore: antiCheat.acceptedMaxScore,
          marginPercent: antiCheat.marginPercent,
          updatedAt: scoreRecord.updatedAt.toISOString(),
        };

        await tx.saveRequest.create({
          data: {
            requestId: dto.requestId,
            playerName: dto.playerName,
            responseJson: JSON.stringify(response),
          },
        });

        return response;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const response = await this.findStoredResponse(dto.requestId);

        if (response) {
          return response;
        }
      }

      throw error;
    }
  }

  async getTopScores(limit?: number): Promise<TopScoreResponse[]> {
    const sanitizedLimit = sanitizeLimit(limit);
    const scores = await this.prisma.score.findMany({
      orderBy: [{ score: 'desc' }, { updatedAt: 'asc' }],
      take: sanitizedLimit,
    });

    return scores.map((score, index) =>
      this.toTopScoreResponse(score, index + 1),
    );
  }

  async getPlayerScore(playerName: string): Promise<MeScoreResponse> {
    const score = await this.prisma.score.findUnique({
      where: { playerName },
    });

    if (!score) {
      throw new NotFoundException({
        message: 'Player score was not found.',
        playerName,
      });
    }

    const rank = await this.calculateRank(score.score);

    return this.toTopScoreResponse(score, rank);
  }

  private async calculateRank(score: number): Promise<number> {
    const betterScoresCount = await this.prisma.score.count({
      where: {
        score: {
          gt: score,
        },
      },
    });

    return betterScoresCount + 1;
  }

  private ensurePlayerCanSave(currentScore: Score | null, now: Date): void {
    if (!currentScore) {
      return;
    }

    const elapsedMilliseconds =
      now.getTime() - currentScore.lastSaveAt.getTime();
    const retryAfterSeconds = Math.ceil(
      RATE_LIMIT_WINDOW_SECONDS - elapsedMilliseconds / 1000,
    );

    if (retryAfterSeconds > 0) {
      throw new RateLimitExceededException(retryAfterSeconds);
    }
  }

  private async findStoredResponse(
    requestId: string,
  ): Promise<SaveScoreResponse | null> {
    const saveRequest = await this.prisma.saveRequest.findUnique({
      where: { requestId },
    });

    return saveRequest
      ? this.parseStoredResponse(saveRequest.responseJson)
      : null;
  }

  private parseStoredResponse(responseJson: string): SaveScoreResponse {
    const parsed: unknown = JSON.parse(responseJson);

    if (isSaveScoreResponse(parsed)) {
      return parsed;
    }

    throw new InternalServerErrorException({
      message: 'Stored idempotency response is invalid.',
    });
  }

  private toTopScoreResponse(score: Score, rank: number): TopScoreResponse {
    return {
      playerName: score.playerName,
      score: score.score,
      rank,
      improvements: parseStoredImprovements(score.improvementsJson),
      elapsedSeconds: score.elapsedSeconds,
      updatedAt: score.updatedAt.toISOString(),
    };
  }
}

function sanitizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_TOP_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_TOP_LIMIT);
}

function parseStoredImprovements(improvementsJson: string): ImprovementLevels {
  const parsed: unknown = JSON.parse(improvementsJson);
  const normalized = normalizeImprovementLevels(parsed);

  return normalized.ok ? normalized.levels : createEmptyImprovementLevels();
}

function isSaveScoreResponse(input: unknown): input is SaveScoreResponse {
  if (!isRecord(input)) {
    return false;
  }

  const normalizedImprovements = normalizeImprovementLevels(input.improvements);

  return (
    typeof input.requestId === 'string' &&
    typeof input.playerName === 'string' &&
    typeof input.submittedScore === 'number' &&
    typeof input.bestScore === 'number' &&
    typeof input.saved === 'boolean' &&
    typeof input.rank === 'number' &&
    typeof input.theoreticalMaxScore === 'number' &&
    typeof input.acceptedMaxScore === 'number' &&
    typeof input.marginPercent === 'number' &&
    typeof input.updatedAt === 'string' &&
    normalizedImprovements.ok
  );
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
