import { randomUUID } from "crypto";
import type { RunStateEntry } from "../types/question.types.js";
import { RUN_STATE_TTL_MS } from "../types/question.types.js";
import {
  getBasePoints,
  computeTimeMultiplier,
  DIFFICULTY_LEVELS,
} from "../config/tokenomics.js";

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

export function createRun(
  walletAddress: string,
  level: number,
  correctIndex: number,
  spentMicroStx: bigint,
  estimatedSolveTimeSec: number,
  category: string
): string {
  schedulePrune();
  const runId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(Date.now() + RUN_STATE_TTL_MS);
  store.set(runId, {
    level,
    correctIndex,
    expiresAt,
    walletAddress,
    completedLevels: 0,
    spentMicroStx,
    totalPoints: 0,
    questionDeliveredAt: now,
    estimatedSolveTimeSec,
    questionIds: [],
    category,
    questionResults: [],
    deliveredQuestionInfo: [],
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

/** Set/update correctIndex and timing when delivering a new question. No retry on same question. */
export function setQuestionForRun(
  runId: string,
  level: number,
  correctIndex: number,
  spentMicroStx: bigint,
  estimatedSolveTimeSec: number
): boolean {
  const entry = store.get(runId);
  if (!entry || new Date() > entry.expiresAt) return false;
  const now = new Date();
  entry.level = level;
  entry.correctIndex = correctIndex;
  entry.expiresAt = new Date(Date.now() + RUN_STATE_TTL_MS);
  entry.spentMicroStx += spentMicroStx;
  entry.questionDeliveredAt = now;
  entry.estimatedSolveTimeSec = estimatedSolveTimeSec;
  store.set(runId, entry);
  return true;
}

export type QuestionResultEntry = { questionId: string; selectedIndex: number; points: number };

export type SubmitResult =
  | { ok: true; correct: true; level: number; completedLevels: number; totalPoints: number }
  | { ok: true; correct: false; runEnded: true; walletAddress: string; completedLevels: number; spentMicroStx: bigint; totalPoints: number; questionIds: string[]; questionResults: QuestionResultEntry[]; deliveredQuestionInfo: DeliveredQuestionInfo[]; correctOptionText?: string; reasoning?: string }
  | { ok: false; reason: string };

/** Verify answer server-side. Score = basePoints × timeMultiplier. Record per-question result for history. */
export function submitAnswer(runId: string, selectedIndex: number): SubmitResult {
  const entry = store.get(runId);
  if (!entry) return { ok: false, reason: "Run not found or expired" };
  if (new Date() > entry.expiresAt) {
    store.delete(runId);
    return { ok: false, reason: "Run expired" };
  }

  const correct = selectedIndex === entry.correctIndex;
  const solveTimeSec = (Date.now() - entry.questionDeliveredAt.getTime()) / 1000;
  const timeMultiplier = computeTimeMultiplier(solveTimeSec, entry.estimatedSolveTimeSec);
  const basePoints = getBasePoints(entry.level);
  const points = correct ? basePoints * timeMultiplier : 0;
  const currentQuestionId = entry.questionIds[entry.questionIds.length - 1];
  if (currentQuestionId) {
    entry.questionResults = entry.questionResults ?? [];
    entry.questionResults.push({ questionId: currentQuestionId, selectedIndex, points });
  }

  if (correct) {
    entry.totalPoints += points;
    const completedLevels = entry.completedLevels + 1;
    const nextLevel = Math.min(entry.level + 1, DIFFICULTY_LEVELS - 1);
    entry.completedLevels = completedLevels;
    entry.level = nextLevel;
    entry.correctIndex = -1;
    entry.expiresAt = new Date(Date.now() + RUN_STATE_TTL_MS);
    store.set(runId, entry);
    return { ok: true, correct: true, level: nextLevel, completedLevels, totalPoints: entry.totalPoints };
  }

  // Wrong answer: run ends; return questionResults and correct-answer info for this question
  const { walletAddress, completedLevels, spentMicroStx, totalPoints, questionIds, questionResults, deliveredQuestionInfo } = entry;
  const lastDelivered = (deliveredQuestionInfo ?? [])[(deliveredQuestionInfo ?? []).length - 1];
  const correctOptionText = lastDelivered?.options?.[entry.correctIndex];
  const reasoning = lastDelivered?.reasoning;
  store.delete(runId);
  return {
    ok: true,
    correct: false,
    runEnded: true,
    walletAddress,
    completedLevels,
    spentMicroStx,
    totalPoints,
    questionIds: questionIds ?? [],
    questionResults: questionResults ?? [],
    deliveredQuestionInfo: deliveredQuestionInfo ?? [],
    correctOptionText,
    reasoning,
  };
}

/** Append a Question id to the run (audit trail). */
export function addQuestionIdToRun(runId: string, questionId: string): boolean {
  const entry = store.get(runId);
  if (!entry || new Date() > entry.expiresAt) return false;
  entry.questionIds.push(questionId);
  store.set(runId, entry);
  return true;
}

export type DeliveredQuestionInfo = { questionId: string; correctIndex: number; options: string[]; reasoning?: string };

/** Store correct answer options and reasoning for a delivered question (for showing on wrong / history). */
export function addDeliveredQuestionInfo(
  runId: string,
  questionId: string,
  correctIndex: number,
  options: string[],
  reasoning?: string
): boolean {
  const entry = store.get(runId);
  if (!entry || new Date() > entry.expiresAt) return false;
  entry.deliveredQuestionInfo = entry.deliveredQuestionInfo ?? [];
  entry.deliveredQuestionInfo.push({ questionId, correctIndex, options, reasoning });
  store.set(runId, entry);
  return true;
}

/** User stopped. Returns run summary (questionIds, questionResults, deliveredQuestionInfo) for settlement and history. */
export function stopRun(runId: string): {
  walletAddress: string;
  completedLevels: number;
  spentMicroStx: bigint;
  totalPoints: number;
  questionIds: string[];
  questionResults: QuestionResultEntry[];
  deliveredQuestionInfo: DeliveredQuestionInfo[];
} | null {
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
    totalPoints: entry.totalPoints,
    questionIds: entry.questionIds ?? [],
    questionResults: entry.questionResults ?? [],
    deliveredQuestionInfo: entry.deliveredQuestionInfo ?? [],
  };
  store.delete(runId);
  return result;
}
