import { randomUUID } from "crypto";
import type { RunStateEntry } from "../types/question.types.js";
import { RUN_STATE_TTL_MS } from "../types/question.types.js";

const store = new Map<string, RunStateEntry>();

const TTL_CHECK_INTERVAL_MS = 60_000;

function pruneExpired(): void {
  const now = new Date();
  for (const [id, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(id);
  }
}

let pruneTimer: ReturnType<typeof setInterval> | null = null;
function schedulePrune(): void {
  if (pruneTimer) return;
  pruneTimer = setInterval(pruneExpired, TTL_CHECK_INTERVAL_MS);
  if (pruneTimer.unref) pruneTimer.unref();
}

export function createRun(walletAddress: string, level: number, correctIndex: number, spentMicroStx: bigint): string {
  schedulePrune();
  const runId = randomUUID();
  const expiresAt = new Date(Date.now() + RUN_STATE_TTL_MS);
  store.set(runId, {
    level,
    correctIndex,
    expiresAt,
    walletAddress,
    completedLevels: 0,
    spentMicroStx,
  });
  return runId;
}

export function getRun(runId: string): RunStateEntry | null {
  const entry = store.get(runId);
  if (!entry) return null;
  if (new Date() > entry.expiresAt) {
    store.delete(runId);
    return null;
  }
  return entry;
}

/** Set/update correctIndex when delivering a new question for this run. No retry on same question. */
export function setQuestionForRun(
  runId: string,
  level: number,
  correctIndex: number,
  spentMicroStx: bigint
): boolean {
  const entry = store.get(runId);
  if (!entry || new Date() > entry.expiresAt) return false;
  entry.level = level;
  entry.correctIndex = correctIndex;
  entry.expiresAt = new Date(Date.now() + RUN_STATE_TTL_MS);
  entry.spentMicroStx += spentMicroStx;
  store.set(runId, entry);
  return true;
}

export type SubmitResult =
  | { ok: true; correct: true; level: number; completedLevels: number }
  | { ok: true; correct: false; runEnded: true; walletAddress: string; completedLevels: number; spentMicroStx: bigint }
  | { ok: false; reason: string };

/** Verify answer server-side. On wrong: end run and clear state. No retry on same question. */
export function submitAnswer(runId: string, selectedIndex: number): SubmitResult {
  const entry = store.get(runId);
  if (!entry) return { ok: false, reason: "Run not found or expired" };
  if (new Date() > entry.expiresAt) {
    store.delete(runId);
    return { ok: false, reason: "Run expired" };
  }

  const correct = selectedIndex === entry.correctIndex;

  if (correct) {
    const completedLevels = entry.completedLevels + 1;
    const level = entry.level + 1;
    entry.completedLevels = completedLevels;
    entry.level = level;
    entry.correctIndex = -1; // consumed; next question will set new one after payment
    entry.expiresAt = new Date(Date.now() + RUN_STATE_TTL_MS);
    store.set(runId, entry);
    return { ok: true, correct: true, level, completedLevels };
  }

  // Wrong answer: run ends immediately
  const { walletAddress, completedLevels, spentMicroStx } = entry;
  store.delete(runId);
  return {
    ok: true,
    correct: false,
    runEnded: true,
    walletAddress,
    completedLevels,
    spentMicroStx,
  };
}

/** User stopped. Returns run summary for persistence and payout; clears state. */
export function stopRun(runId: string): { walletAddress: string; completedLevels: number; spentMicroStx: bigint } | null {
  const entry = store.get(runId);
  if (!entry) return null;
  if (new Date() > entry.expiresAt) {
    store.delete(runId);
    return null;
  }
  const result = {
    walletAddress: entry.walletAddress,
    completedLevels: entry.completedLevels,
    spentMicroStx: entry.spentMicroStx,
  };
  store.delete(runId);
  return result;
}
