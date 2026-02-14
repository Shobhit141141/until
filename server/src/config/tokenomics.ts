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

/** No platform fee. netEarned = grossEarned. */
export const PLATFORM_FEE = 0;

/** Minimum STX to withdraw from credits balance. */
export const MIN_WITHDRAW_STX = 0.01;

/** Suggested top-up amount (one wallet interaction). */
export const TOP_UP_SUGGESTED_STX = 0.05;

/** Run cap for milestone tiers (e.g. 10). */
export const MAX_QUESTIONS = 10;

/** Fixed incentive pool for milestone bonuses (STX). Target 10–15% of expected full-run spend (e.g. ~0.10 STX for 10 questions) → 0.01–0.015 STX. Bonus should feel exciting, not dominate earnings. */
export const BONUS_POOL_STX = Number(process.env.BONUS_POOL_STX) || 0.0125;

const MICRO_STX_PER_STX = 1_000_000;

export function getMinWithdrawMicroStx(): bigint {
  return BigInt(Math.round(MIN_WITHDRAW_STX * MICRO_STX_PER_STX));
}

export function getTopUpSuggestedMicroStx(): bigint {
  return BigInt(Math.round(TOP_UP_SUGGESTED_STX * MICRO_STX_PER_STX));
}

/** Time multiplier. Timing = bonus, not gate. */
export const TIME_MULTIPLIER_MIN = 0.8;
export const TIME_MULTIPLIER_MAX = 1.6;

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

/** netEarnedStx = grossEarned (no platform fee). */
export function grossToNetEarnedStx(grossStx: number): number {
  return grossStx;
}

/** profit = netEarned − totalSpent */
export function computeProfit(netEarnedStx: number, totalSpentStx: number): number {
  return netEarnedStx - totalSpentStx;
}

/** Milestone bonus (fixed, no RNG). 70% completion => BONUS_POOL/4; 100% => BONUS_POOL. */
export function computeMilestoneBonus(completedLevels: number): number {
  if (completedLevels >= MAX_QUESTIONS) return BONUS_POOL_STX;
  const threshold70 = Math.ceil(0.7 * MAX_QUESTIONS);
  if (completedLevels >= threshold70) return BONUS_POOL_STX / 4;
  return 0;
}

/** Time multiplier. ratio = estimated/actual; faster solve => higher multiplier. Smooth, no cliffs. */
export function computeTimeMultiplier(
  solveTimeSec: number,
  estimatedSolveTimeSec: number
): number {
  if (estimatedSolveTimeSec <= 0) return TIME_MULTIPLIER_MAX;
  if (solveTimeSec <= 0) return TIME_MULTIPLIER_MAX;
  const ratio = estimatedSolveTimeSec / solveTimeSec;
  const raw = 0.8 + 0.4 * Math.log2(ratio + 1);
  return Math.max(TIME_MULTIPLIER_MIN, Math.min(TIME_MULTIPLIER_MAX, raw));
}
