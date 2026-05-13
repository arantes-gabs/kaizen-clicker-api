import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import {
  ANTI_CHEAT_MARGIN_PERCENT,
  EXPECTED_POINTS_PER_MANUAL_CLICK,
  FactoryProjection,
  ImprovementLevels,
  MAX_REASONABLE_CLICKS_PER_SECOND,
  calculateFactoryProjection,
  normalizeImprovementLevels,
} from './game-rules';

export type AntiCheatValidationResult = {
  improvements: ImprovementLevels;
  projection: FactoryProjection;
  automaticMaxScore: number;
  manualClickScore: number;
  theoreticalMaxScore: number;
  acceptedMaxScore: number;
  marginPercent: number;
};

type ValidateScoreInput = {
  score: number;
  elapsedSeconds: number;
  improvements: unknown;
};

@Injectable()
export class AntiCheatService {
  validateScore(input: ValidateScoreInput): AntiCheatValidationResult {
    const normalizedImprovements = normalizeImprovementLevels(
      input.improvements,
    );

    if (!normalizedImprovements.ok) {
      throw new UnprocessableEntityException({
        message: normalizedImprovements.message,
      });
    }

    const projection = calculateFactoryProjection(
      normalizedImprovements.levels,
    );

    const automaticMaxScore =
      input.elapsedSeconds * projection.goodPiecesPerSecond;
    const manualClickScore =
      input.elapsedSeconds *
      MAX_REASONABLE_CLICKS_PER_SECOND *
      EXPECTED_POINTS_PER_MANUAL_CLICK;
    const theoreticalMaxScore = automaticMaxScore + manualClickScore;
    const acceptedMaxScore = Math.ceil(
      theoreticalMaxScore * (1 + ANTI_CHEAT_MARGIN_PERCENT / 100) + 1,
    );

    if (input.score > acceptedMaxScore) {
      throw new UnprocessableEntityException({
        message: 'Submitted score exceeds the theoretical maximum.',
        submittedScore: input.score,
        acceptedMaxScore,
        theoreticalMaxScore: roundScore(theoreticalMaxScore),
        marginPercent: ANTI_CHEAT_MARGIN_PERCENT,
      });
    }

    return {
      improvements: normalizedImprovements.levels,
      projection,
      automaticMaxScore: roundScore(automaticMaxScore),
      manualClickScore: roundScore(manualClickScore),
      theoreticalMaxScore: roundScore(theoreticalMaxScore),
      acceptedMaxScore,
      marginPercent: ANTI_CHEAT_MARGIN_PERCENT,
    };
  }
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}
