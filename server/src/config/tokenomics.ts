/**
 * Fair tokenomics (locked):
 * - Levels 1–10. Must play till level 4 before can stop.
 * - Timer buckets: ≤60% → 1.5×, 60–90% → 1.2×, 90–100% → 1.0×. Timeout = wrong (run ends).
 * - Profit = Total Earned − Total Spent. Wrong answer: run ends, earned kept, current level cost lost.
 * - K = scaling factor (volume knob). Only scales money amounts; does not change EV or fairness.
 *
 * L1 margin rule (do NOT use K to fix margins): At L1, best-case reward ≈ 1.3×–1.5× cost.
 * Base reward = cost (1:1) so fast (1.5×) → profit ≈ 0.5× cost. K cannot fix thin margins.
 * Keep K in 500–2000 for real USD feel (~$0.25 L1 best-case at K=1000). Do NOT push K to 100k+.
 *
 * K bands: 10–25 toy, 100 default, 250 serious, 500–2000 real stakes. Env: SCALE_K.
 */

export const DIFFICULTY_LEVELS = 10; // levels 1–10 (0-indexed 0..9)

/** Scaling factor for money amounts. Default 100; 500–2000 for real USD. Env: SCALE_K. */
export const SCALE_K = Math.max(1, Math.min(2000, Number(process.env.SCALE_K) || 100));

/** Cost in STX per level (1–10), base table at K=100. Actual = base × (K/100). */
export const COST_STX_BY_DIFFICULTY: readonly number[] = [
  0.72, 1.44, 2.16, 2.88, 4.32, 6.48, 9.36, 12.96, 17.28, 22.32,
];

/** Base reward in STX per level. 1:1 with cost so best-case (1.5×) → profit ≈ 0.5× cost. */
export const BASE_REWARD_STX_BY_DIFFICULTY: readonly number[] = [
  0.72, 1.44, 2.16, 2.88, 4.32, 6.48, 9.36, 12.96, 17.28, 22.32,
];

/** Difficulty labels (Level 1–10). */
export const DIFFICULTY_LABELS: readonly string[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
];

/** Must complete at least this many levels before user can stop. */
export const MIN_LEVEL_BEFORE_STOP = 4;

/** No platform fee. netEarned = grossEarned. */
export const PLATFORM_FEE = 0;

/** Minimum STX to withdraw from credits balance. */
export const MIN_WITHDRAW_STX = 0.01;

/** Suggested top-up amount (one wallet interaction). */
export const TOP_UP_SUGGESTED_STX = 0.05;

/** Run cap for milestone tiers. */
export const MAX_QUESTIONS = 10;

/** Fixed incentive pool for milestone bonuses (STX) at K=100. Scaled by K for actual payouts. */
const BONUS_POOL_BASE_STX = Number(process.env.BONUS_POOL_STX) || 4.5;

const MICRO_STX_PER_STX = 1_000_000;

export function getMinWithdrawMicroStx(): bigint {
  return BigInt(Math.round(MIN_WITHDRAW_STX * MICRO_STX_PER_STX));
}

export function getTopUpSuggestedMicroStx(): bigint {
  return BigInt(Math.round(TOP_UP_SUGGESTED_STX * MICRO_STX_PER_STX));
}

export function getCostStx(difficulty: number): number {
  const d = Math.max(0, Math.min(difficulty, DIFFICULTY_LEVELS - 1));
  const base = COST_STX_BY_DIFFICULTY[d] ?? COST_STX_BY_DIFFICULTY[0];
  return base * (SCALE_K / 100);
}

/** Cost in microSTX for 402 challenge. */
export function getCostMicroStx(difficulty: number): bigint {
  const stx = getCostStx(difficulty);
  return BigInt(Math.round(stx * 1_000_000));
}

/** Base reward in STX for this level (on-paper). Earned = base × time multiplier. */
export function getBaseRewardStx(difficulty: number): number {
  const d = Math.max(0, Math.min(difficulty, DIFFICULTY_LEVELS - 1));
  const base = BASE_REWARD_STX_BY_DIFFICULTY[d] ?? BASE_REWARD_STX_BY_DIFFICULTY[0];
  return base * (SCALE_K / 100);
}

/** @deprecated Use getBaseRewardStx. Kept for compatibility; returns base reward in STX. */
export function getBasePoints(difficulty: number): number {
  return getBaseRewardStx(difficulty);
}

export function getDifficultyLabel(difficulty: number): string {
  const d = Math.max(0, Math.min(difficulty, DIFFICULTY_LEVELS - 1));
  return DIFFICULTY_LABELS[d] ?? DIFFICULTY_LABELS[0];
}

/** totalPoints is already in STX (sum of baseReward × timeMultiplier per question). */
export function pointsToGrossEarnedStx(totalPoints: number): number {
  return totalPoints;
}

/** netEarnedStx = grossEarned (no platform fee). */
export function grossToNetEarnedStx(grossStx: number): number {
  return grossStx;
}

/** profit = netEarned − totalSpent */
export function computeProfit(netEarnedStx: number, totalSpentStx: number): number {
  return netEarnedStx - totalSpentStx;
}

/** Milestone bonus (fixed, no RNG). 70% completion => pool/4; 100% => full pool. Pool scaled by K. */
export function computeMilestoneBonus(completedLevels: number): number {
  const poolStx = BONUS_POOL_BASE_STX * (SCALE_K / 100);
  if (completedLevels >= MAX_QUESTIONS) return poolStx;
  const threshold70 = Math.ceil(0.7 * MAX_QUESTIONS);
  if (completedLevels >= threshold70) return poolStx / 4;
  return 0;
}

/**
 * Time multiplier (strict buckets).
 * ratio = solveTime / allowedTime.
 * ≤60% → 1.5×, 60–90% → 1.2×, 90–100% → 1.0×.
 * Caller must treat ratio > 1 (timeout) as wrong (run ends).
 */
export function computeTimeMultiplier(
  solveTimeSec: number,
  estimatedSolveTimeSec: number
): number {
  if (estimatedSolveTimeSec <= 0) return 1.5;
  if (solveTimeSec <= 0) return 1.5;
  const ratio = solveTimeSec / estimatedSolveTimeSec;
  if (ratio <= 0.6) return 1.5;
  if (ratio <= 0.9) return 1.2;
  if (ratio <= 1) return 1.0;
  return 1.0; // timeout case: caller treats as wrong, multiplier unused
}

/** True if solve time exceeded allowed time (timeout = wrong). */
export function isTimeout(solveTimeSec: number, allowedTimeSec: number): boolean {
  return allowedTimeSec > 0 && solveTimeSec > allowedTimeSec;
}
