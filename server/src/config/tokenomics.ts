export const DIFFICULTY_LEVELS = 10; // 0–9

/** Cost in STX per difficulty. */
export const COST_STX_BY_DIFFICULTY: readonly number[] = [
  0.001, 0.002, 0.003, 0.005, 0.007, 0.01, 0.015, 0.02, 0.03, 0.05,
];

/** Base points per difficulty. */
export const BASE_POINTS_BY_DIFFICULTY: readonly number[] = [
  5, 10, 18, 30, 45, 70, 110, 170, 260, 400,
];

/** Difficulty labels. */
export const DIFFICULTY_LABELS: readonly string[] = [
  "Warm-up",
  "Basic",
  "Easy",
  "Comfortable",
  "Moderate",
  "Challenging",
  "Hard",
  "Very Hard",
  "Expert",
  "Brutal",
];

/** 100 points = 0.01 STX. So 1 point = 0.0001 STX. */
export const STX_PER_POINT = 0.0001;

/** Platform fee. netEarned = grossEarned × (1 − fee). */
export const PLATFORM_FEE = 0.1;

/** Time multiplier. */
export const TIME_MULTIPLIER_MIN = 0.5;
export const TIME_MULTIPLIER_MAX = 1.5;

export function getCostStx(difficulty: number): number {
  const d = Math.max(0, Math.min(difficulty, DIFFICULTY_LEVELS - 1));
  return COST_STX_BY_DIFFICULTY[d] ?? COST_STX_BY_DIFFICULTY[0];
}

/** Cost in microSTX for 402 challenge. */
export function getCostMicroStx(difficulty: number): bigint {
  const stx = getCostStx(difficulty);
  return BigInt(Math.round(stx * 1_000_000));
}

export function getBasePoints(difficulty: number): number {
  const d = Math.max(0, Math.min(difficulty, DIFFICULTY_LEVELS - 1));
  return BASE_POINTS_BY_DIFFICULTY[d] ?? BASE_POINTS_BY_DIFFICULTY[0];
}

export function getDifficultyLabel(difficulty: number): string {
  const d = Math.max(0, Math.min(difficulty, DIFFICULTY_LEVELS - 1));
  return DIFFICULTY_LABELS[d] ?? DIFFICULTY_LABELS[0];
}

/** grossEarnedStx = totalPoints × STX_PER_POINT */
export function pointsToGrossEarnedStx(totalPoints: number): number {
  return totalPoints * STX_PER_POINT;
}

/** netEarnedStx = grossEarned × (1 − PLATFORM_FEE) */
export function grossToNetEarnedStx(grossStx: number): number {
  return grossStx * (1 - PLATFORM_FEE);
}

/** profit = netEarned − totalSpent */
export function computeProfit(netEarnedStx: number, totalSpentStx: number): number {
  return netEarnedStx - totalSpentStx;
}

/** Time multiplier. Faster solve => higher multiplier. */
export function computeTimeMultiplier(
  solveTimeSec: number,
  estimatedSolveTimeSec: number
): number {
  if (estimatedSolveTimeSec <= 0) return TIME_MULTIPLIER_MAX;
  const ratio = solveTimeSec / (2 * estimatedSolveTimeSec);
  const raw = TIME_MULTIPLIER_MAX - ratio * (TIME_MULTIPLIER_MAX - TIME_MULTIPLIER_MIN);
  return Math.max(TIME_MULTIPLIER_MIN, Math.min(TIME_MULTIPLIER_MAX, raw));
}
