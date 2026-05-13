export const INITIAL_FACTORY_STATE = {
  productionPerSecond: 1,
  defectRate: 0.3,
  oee: 0.4,
} as const;

export const MAX_IMPROVEMENT_LEVEL = 5;
export const ANTI_CHEAT_MARGIN_PERCENT = 10;
export const MAX_REASONABLE_CLICKS_PER_SECOND = 8;
export const EXPECTED_POINTS_PER_MANUAL_CLICK = 1;
export const RATE_LIMIT_WINDOW_SECONDS = 10;
export const DEFAULT_TOP_LIMIT = 10;
export const MAX_TOP_LIMIT = 50;

export const IMPROVEMENT_IDS = [
  'fiveS',
  'kanban',
  'pokaYoke',
  'tpm',
  'andon',
  'jidoka',
  'heijunka',
  'justInTime',
] as const;

export type ImprovementId = (typeof IMPROVEMENT_IDS)[number];
export type ImprovementLevels = Record<ImprovementId, number>;

type ImprovementRule = {
  id: ImprovementId;
  displayName: string;
  aliases: readonly string[];
  baseCost: number;
  speedDeltaPerLevel?: number;
  defectRateDeltaPerLevel?: number;
  oeeDeltaPerLevel?: number;
  downtimeMultiplierPerLevel?: number;
  conditionalSpeedDeltaPerLevel?: number;
  requiresDefectRateBelow?: number;
};

export type FactoryProjection = {
  productionPerSecond: number;
  speedMultiplier: number;
  defectRate: number;
  oee: number;
  goodPiecesPerSecond: number;
};

export const IMPROVEMENT_RULES: readonly ImprovementRule[] = [
  {
    id: 'fiveS',
    displayName: '5S',
    aliases: ['5s', 'fiveS', 'five-s'],
    baseCost: 50,
    defectRateDeltaPerLevel: 0.05,
    speedDeltaPerLevel: 0.1,
  },
  {
    id: 'kanban',
    displayName: 'Kanban',
    aliases: ['kanban'],
    baseCost: 200,
    speedDeltaPerLevel: 0.2,
  },
  {
    id: 'pokaYoke',
    displayName: 'Poka-Yoke',
    aliases: ['pokaYoke', 'poka-yoke', 'poka yoke', 'pokayoke'],
    baseCost: 500,
    defectRateDeltaPerLevel: 0.15,
  },
  {
    id: 'tpm',
    displayName: 'TPM',
    aliases: ['tpm'],
    baseCost: 1500,
    defectRateDeltaPerLevel: 0.1,
    oeeDeltaPerLevel: 0.15,
  },
  {
    id: 'andon',
    displayName: 'Andon',
    aliases: ['andon'],
    baseCost: 4000,
    downtimeMultiplierPerLevel: 0.9,
  },
  {
    id: 'jidoka',
    displayName: 'Jidoka',
    aliases: ['jidoka'],
    baseCost: 7500,
    defectRateDeltaPerLevel: 0.4,
    speedDeltaPerLevel: -0.1,
  },
  {
    id: 'heijunka',
    displayName: 'Heijunka',
    aliases: ['heijunka'],
    baseCost: 10000,
    oeeDeltaPerLevel: 0.25,
  },
  {
    id: 'justInTime',
    displayName: 'Just-In-Time',
    aliases: ['justInTime', 'just-in-time', 'just in time', 'jit'],
    baseCost: 25000,
    conditionalSpeedDeltaPerLevel: 0.5,
    requiresDefectRateBelow: 0.05,
  },
] as const;

export type ImprovementNormalizationResult =
  | {
      ok: true;
      levels: ImprovementLevels;
    }
  | {
      ok: false;
      message: string;
    };

const IMPROVEMENT_KEY_BY_ALIAS = new Map<string, ImprovementId>(
  IMPROVEMENT_RULES.flatMap((rule) =>
    [rule.id, rule.displayName, ...rule.aliases].map((alias) => [
      normalizeImprovementKey(alias),
      rule.id,
    ]),
  ),
);

export function createEmptyImprovementLevels(): ImprovementLevels {
  return {
    fiveS: 0,
    kanban: 0,
    pokaYoke: 0,
    tpm: 0,
    andon: 0,
    jidoka: 0,
    heijunka: 0,
    justInTime: 0,
  };
}

export function calculateImprovementCost(
  improvementId: ImprovementId,
  purchaseCount: number,
): number {
  const rule = IMPROVEMENT_RULES.find((item) => item.id === improvementId);

  if (!rule) {
    return 0;
  }

  return rule.baseCost * 1.5 ** purchaseCount;
}

export function normalizeImprovementLevels(
  input: unknown,
): ImprovementNormalizationResult {
  if (Array.isArray(input)) {
    return normalizeImprovementArray(input);
  }

  if (isPlainRecord(input)) {
    return normalizeImprovementRecord(input);
  }

  return {
    ok: false,
    message:
      'improvements must be an object or an array of improvement levels.',
  };
}

export function calculateFactoryProjection(
  levels: ImprovementLevels,
): FactoryProjection {
  let speedMultiplier = 1;
  let defectRate: number = INITIAL_FACTORY_STATE.defectRate;
  let oee: number = INITIAL_FACTORY_STATE.oee;

  for (const rule of IMPROVEMENT_RULES) {
    const level = levels[rule.id];

    speedMultiplier += (rule.speedDeltaPerLevel ?? 0) * level;
    defectRate -= (rule.defectRateDeltaPerLevel ?? 0) * level;
    oee += (rule.oeeDeltaPerLevel ?? 0) * level;
  }

  defectRate = clamp(defectRate, 0, 1);
  oee = clamp(oee, 0, 1);

  const justInTimeRule = IMPROVEMENT_RULES.find(
    (rule) => rule.id === 'justInTime',
  );

  if (
    justInTimeRule?.conditionalSpeedDeltaPerLevel &&
    justInTimeRule.requiresDefectRateBelow !== undefined &&
    defectRate < justInTimeRule.requiresDefectRateBelow
  ) {
    speedMultiplier +=
      justInTimeRule.conditionalSpeedDeltaPerLevel * levels.justInTime;
  }

  const andonRule = IMPROVEMENT_RULES.find((rule) => rule.id === 'andon');
  const downtimeMultiplier = andonRule?.downtimeMultiplierPerLevel ?? 1;
  const remainingDowntime = (1 - oee) * downtimeMultiplier ** levels.andon;
  const effectiveOee = clamp(1 - remainingDowntime, 0, 1);
  const effectiveSpeedMultiplier = Math.max(speedMultiplier, 0.1);
  const goodPiecesPerSecond =
    INITIAL_FACTORY_STATE.productionPerSecond *
    effectiveSpeedMultiplier *
    (1 - defectRate) *
    effectiveOee;

  return {
    productionPerSecond: INITIAL_FACTORY_STATE.productionPerSecond,
    speedMultiplier: effectiveSpeedMultiplier,
    defectRate,
    oee: effectiveOee,
    goodPiecesPerSecond,
  };
}

function normalizeImprovementArray(
  input: readonly unknown[],
): ImprovementNormalizationResult {
  const levels = createEmptyImprovementLevels();

  for (const item of input) {
    if (!isPlainRecord(item)) {
      return {
        ok: false,
        message: 'each improvement array item must be an object.',
      };
    }

    const key = readStringProperty(item, [
      'id',
      'key',
      'name',
      'improvement',
      'type',
    ]);
    const improvementId = key ? resolveImprovementId(key) : null;
    const level = readLevelFromRecord(item);

    if (!improvementId || level === null) {
      return {
        ok: false,
        message:
          'each improvement array item must include a known id/name and a level from 0 to 5.',
      };
    }

    levels[improvementId] = level;
  }

  return { ok: true, levels };
}

function normalizeImprovementRecord(
  input: Readonly<Record<string, unknown>>,
): ImprovementNormalizationResult {
  const levels = createEmptyImprovementLevels();

  for (const [rawKey, rawLevel] of Object.entries(input)) {
    const improvementId = resolveImprovementId(rawKey);
    const level = readLevelFromValue(rawLevel);

    if (!improvementId || level === null) {
      return {
        ok: false,
        message:
          'improvements object must use known improvement keys with levels from 0 to 5.',
      };
    }

    levels[improvementId] = level;
  }

  return { ok: true, levels };
}

function readLevelFromRecord(
  input: Readonly<Record<string, unknown>>,
): number | null {
  for (const field of ['level', 'purchaseCount', 'count', 'purchases']) {
    const level = readLevelFromValue(input[field]);

    if (level !== null) {
      return level;
    }
  }

  return null;
}

function readLevelFromValue(input: unknown): number | null {
  if (typeof input === 'number') {
    return normalizeLevel(input);
  }

  if (isPlainRecord(input)) {
    return readLevelFromRecord(input);
  }

  return null;
}

function normalizeLevel(input: number): number | null {
  if (!Number.isInteger(input) || input < 0 || input > MAX_IMPROVEMENT_LEVEL) {
    return null;
  }

  return input;
}

function readStringProperty(
  input: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): string | null {
  for (const field of fields) {
    const value = input[field];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function resolveImprovementId(input: string): ImprovementId | null {
  return IMPROVEMENT_KEY_BY_ALIAS.get(normalizeImprovementKey(input)) ?? null;
}

function normalizeImprovementKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isPlainRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
