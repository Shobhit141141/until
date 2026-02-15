/** Client-side tokenomics helpers (match server). For display and breakdown only. */

/** Every question is capped at 30s. Never use AI's estimated_solve_time_sec for timer or timeout. */
export const QUESTION_TIME_CAP_SEC = 30;

export const COST_STX_BY_LEVEL = [
  0.72, 1.44, 2.16, 2.88, 4.32, 6.48, 9.36, 12.96, 17.28, 22.32,
] as const;

export function getCostStx(level: number): number {
  return COST_STX_BY_LEVEL[Math.max(0, Math.min(level, 9))] ?? 0.72;
}

export function getBaseRewardStx(level: number): number {
  return getCostStx(level);
}

/** Time multiplier from ratio (solveTime / allowedTime). ≤60% → 1.5, 60–90% → 1.2, 90–100% → 1.0. */
export function getTimeMultiplier(timeTakenSec: number, allowedSec: number): number {
  if (allowedSec <= 0) return 1;
  const ratio = timeTakenSec / allowedSec;
  if (ratio <= 0.6) return 1.5;
  if (ratio <= 0.9) return 1.2;
  return 1;
}

export function getEarnedStx(level: number, timeTakenSec: number, allowedSec: number): number {
  const base = getBaseRewardStx(level);
  const mult = getTimeMultiplier(timeTakenSec, allowedSec);
  return base * mult;
}
