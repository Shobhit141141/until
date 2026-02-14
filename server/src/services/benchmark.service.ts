/** Benchmark increases monotonically. Stub: threshold levels to qualify for reward. */
export function getBenchmark(completedLevels: number): number {
  return Math.max(0, completedLevels - 1);
}

/** Deterministic reward when score > benchmark. Stub: 1 STX per level above benchmark. */
export function computeEarnedStx(score: number, benchmark: number): number {
  if (score <= benchmark) return 0;
  return score - benchmark;
}
