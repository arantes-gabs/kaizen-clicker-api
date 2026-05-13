import { Logger } from '@nestjs/common';
import type { SaveRequest, Score } from '@prisma/client';
import { RateLimitExceededException } from '../../common/errors/rate-limit-exceeded.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AntiCheatService } from '../anti-cheat/anti-cheat.service';
import { createEmptyImprovementLevels } from '../anti-cheat/game-rules';
import { CreateScoreDto } from './dto/create-score.dto';
import { ScoresService } from './scores.service';

type ScoreCreateArgs = {
  data: Pick<
    Score,
    | 'playerName'
    | 'score'
    | 'improvementsJson'
    | 'elapsedSeconds'
    | 'lastSaveAt'
  >;
};

type ScoreUpdateArgs = {
  where: Pick<Score, 'playerName'>;
  data: Partial<
    Pick<Score, 'score' | 'improvementsJson' | 'elapsedSeconds' | 'lastSaveAt'>
  >;
};

type ScoreFindUniqueArgs = {
  where: Pick<Score, 'playerName'>;
};

type ScoreCountArgs = {
  where?: {
    score?: {
      gt?: number;
    };
  };
};

type SaveRequestCreateArgs = {
  data: Pick<SaveRequest, 'requestId' | 'playerName' | 'responseJson'>;
};

type SaveRequestFindUniqueArgs = {
  where: Pick<SaveRequest, 'requestId'>;
};

describe('ScoresService', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  afterAll(() => {
    Logger.overrideLogger(undefined);
  });

  it('does not overwrite a higher score with a lower score', async () => {
    const { service, scores, ageLastSave } = createServiceHarness();

    await service.saveScore(
      makeCreateScoreDto({
        score: 200,
        requestId: '2e15a0f8-40f1-4f53-8f0a-4234ca729c01',
      }),
    );
    ageLastSave('Ana', 11_000);

    const response = await service.saveScore(
      makeCreateScoreDto({
        score: 100,
        requestId: '54dd4151-f86d-432f-b001-6936844f4207',
      }),
    );

    expect(response.saved).toBe(false);
    expect(response.bestScore).toBe(200);
    expect(scores.get('Ana')?.score).toBe(200);
  });

  it('returns the same response for an idempotent request', async () => {
    const { service, saveRequests } = createServiceHarness();
    const dto = makeCreateScoreDto({
      requestId: '338f7a60-67a5-4c79-a759-f6284b181210',
    });

    const firstResponse = await service.saveScore(dto);
    const secondResponse = await service.saveScore(dto);

    expect(secondResponse).toEqual(firstResponse);
    expect(saveRequests.size).toBe(1);
  });

  it('rejects a new save within the player rate limit window', async () => {
    const { service } = createServiceHarness();

    await service.saveScore(
      makeCreateScoreDto({
        requestId: '7605f473-c87b-4eb2-84a8-baf6526d30cf',
      }),
    );

    await expect(
      service.saveScore(
        makeCreateScoreDto({
          requestId: '01a9b4d3-1351-48cd-a37c-cdbf2cb56984',
        }),
      ),
    ).rejects.toBeInstanceOf(RateLimitExceededException);
  });
});

function createServiceHarness(): {
  service: ScoresService;
  scores: Map<string, Score>;
  saveRequests: Map<string, SaveRequest>;
  ageLastSave: (playerName: string, milliseconds: number) => void;
} {
  const scores = new Map<string, Score>();
  const saveRequests = new Map<string, SaveRequest>();
  let nextScoreId = 1;
  let nextSaveRequestId = 1;

  const tx = {
    score: {
      findUnique: jest.fn(({ where }: ScoreFindUniqueArgs) =>
        Promise.resolve(scores.get(where.playerName) ?? null),
      ),
      create: jest.fn(({ data }: ScoreCreateArgs) => {
        const now = new Date();
        const score: Score = {
          id: nextScoreId,
          ...data,
          createdAt: now,
          updatedAt: now,
        };

        nextScoreId += 1;
        scores.set(score.playerName, score);

        return Promise.resolve(score);
      }),
      update: jest.fn(({ where, data }: ScoreUpdateArgs) => {
        const existingScore = scores.get(where.playerName);

        if (!existingScore) {
          throw new Error('Score not found in test harness.');
        }

        const updatedScore: Score = {
          ...existingScore,
          ...data,
          updatedAt: new Date(),
        };

        scores.set(updatedScore.playerName, updatedScore);

        return Promise.resolve(updatedScore);
      }),
      count: jest.fn(({ where }: ScoreCountArgs = {}) => {
        const greaterThanScore = where?.score?.gt;

        if (greaterThanScore === undefined) {
          return Promise.resolve(scores.size);
        }

        return Promise.resolve(
          [...scores.values()].filter((score) => score.score > greaterThanScore)
            .length,
        );
      }),
      findMany: jest.fn(() => Promise.resolve([...scores.values()])),
    },
    saveRequest: {
      findUnique: jest.fn(({ where }: SaveRequestFindUniqueArgs) =>
        Promise.resolve(saveRequests.get(where.requestId) ?? null),
      ),
      create: jest.fn(({ data }: SaveRequestCreateArgs) => {
        const saveRequest: SaveRequest = {
          id: nextSaveRequestId,
          ...data,
          createdAt: new Date(),
        };

        nextSaveRequestId += 1;
        saveRequests.set(saveRequest.requestId, saveRequest);

        return Promise.resolve(saveRequest);
      }),
    },
  };

  const prisma = {
    score: tx.score,
    saveRequest: tx.saveRequest,
    $transaction: jest.fn(
      <Result>(callback: (transaction: typeof tx) => Promise<Result>) =>
        callback(tx),
    ),
  };

  return {
    service: new ScoresService(
      prisma as unknown as PrismaService,
      new AntiCheatService(),
    ),
    scores,
    saveRequests,
    ageLastSave: (playerName: string, milliseconds: number) => {
      const score = scores.get(playerName);

      if (score) {
        scores.set(playerName, {
          ...score,
          lastSaveAt: new Date(Date.now() - milliseconds),
        });
      }
    },
  };
}

function makeCreateScoreDto(
  overrides: Partial<CreateScoreDto>,
): CreateScoreDto {
  const dto = new CreateScoreDto();

  dto.playerName = overrides.playerName ?? 'Ana';
  dto.score = overrides.score ?? 100;
  dto.improvements = overrides.improvements ?? createEmptyImprovementLevels();
  dto.elapsedSeconds = overrides.elapsedSeconds ?? 1_000;
  dto.requestId = overrides.requestId ?? '03f208ba-5b7f-48c1-b9f9-278b72643dc3';

  return dto;
}
