/**
 * Per-run question batch: Map<runId, Question[]>.
 * Same category for the run; refill in background when few left. Remove question from cache when used.
 */
import type { AiQuestionPayload } from "../types/question.types.js";
import * as runStateService from "./run-state.service.js";
import * as aiService from "./ai.service.js";
import * as fallbackQuestions from "./fallback-questions.service.js";
import { getRandomCategory } from "../config/categories.js";
import { logger } from "../config/logger.js";

/** Initial and refill batch: 20–25 questions of increasing difficulty, same category. */
const BATCH_SIZE = 25;
const REFILL_THRESHOLD = 6;

type RunBatchEntry = {
  category: string;
  questions: AiQuestionPayload[];
};

const runBatchStore = new Map<string, RunBatchEntry>();

/**
 * Get the category for a run (from run state). Returns undefined if run not found.
 */
export function getCategoryForRun(runId: string): string | undefined {
  const run = runStateService.getRun(runId);
  return run?.category;
}

/**
 * Pop the next question for this run. Returns null if run has no batch or batch empty.
 * Caller should refill or generate one if null.
 */
export function popQuestion(runId: string): AiQuestionPayload | null {
  const entry = runBatchStore.get(runId);
  if (!entry || entry.questions.length === 0) return null;
  const payload = entry.questions.shift()!;
  if (entry.questions.length === 0) runBatchStore.delete(runId);
  return payload;
}

/**
 * Set the batch for a run (e.g. after first question: store the rest of the initial batch).
 * Overwrites any existing batch for this runId.
 */
export function setBatch(runId: string, category: string, questions: AiQuestionPayload[]): void {
  if (questions.length === 0) return;
  runBatchStore.set(runId, { category, questions });
}

/**
 * Append questions to the run's batch (refill). No-op if run has no batch yet (use setBatch for first time).
 */
export function appendToBatch(runId: string, questions: AiQuestionPayload[]): void {
  if (questions.length === 0) return;
  const entry = runBatchStore.get(runId);
  if (!entry) return;
  entry.questions.push(...questions);
}

/**
 * Return how many questions are left in the run's batch.
 */
export function getBatchSize(runId: string): number {
  const entry = runBatchStore.get(runId);
  return entry ? entry.questions.length : 0;
}

/**
 * Trigger background refill when batch has <= REFILL_THRESHOLD questions.
 * Uses run's category and current level as startLevel. Does not await.
 */
export function refillRunBatchIfNeeded(runId: string): void {
  const run = runStateService.getRun(runId);
  if (!run) return;
  const size = getBatchSize(runId);
  if (size > REFILL_THRESHOLD) return;
  const category = run.category;
  const startLevel = run.level;
  const seed = `refill-${runId}-${Date.now()}`;
  aiService
    .generateQuestionBatch(
      { category, startLevel, count: BATCH_SIZE, seed },
      BATCH_SIZE
    )
    .then((questions) => {
      if (questions.length === 0) return;
      const entry = runBatchStore.get(runId);
      if (entry) {
        entry.questions.push(...questions);
      } else {
        runBatchStore.set(runId, { category, questions: [...questions] });
      }
      logger.info("Run batch refilled", { runId: runId.slice(0, 8), added: questions.length });
    })
    .catch((err) => {
      logger.warn("Run batch refill failed, trying fallback", { runId: runId.slice(0, 8), err: String(err) });
      const questions = fallbackQuestions.getFallbackBatch(category, startLevel, BATCH_SIZE);
      if (questions.length > 0) {
        const entry = runBatchStore.get(runId);
        if (entry) {
          entry.questions.push(...questions);
          logger.info("Run batch refilled from fallback", { runId: runId.slice(0, 8), added: questions.length });
        }
      }
    });
}

/**
 * Pick a category for a new run (server-side only).
 */
export function pickCategoryForNewRun(): string {
  return getRandomCategory();
}

/**
 * Generate initial batch for a new run: same category, BATCH_SIZE questions of increasing difficulty (0, 1, …, BATCH_SIZE-1).
 * Returns { first, rest } so caller can use first and store rest.
 * If AI fails, uses static fallback questions (last resort).
 */
export async function createInitialBatch(category: string): Promise<{
  first: AiQuestionPayload;
  rest: AiQuestionPayload[];
}> {
  const seed = `init-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let batch: AiQuestionPayload[];
  try {
    batch = await aiService.generateQuestionBatch(
      { category, startLevel: 0, count: BATCH_SIZE, seed },
      BATCH_SIZE
    );
  } catch (err) {
    logger.warn("AI batch failed, using fallback questions", { category, err: String(err) });
    batch = fallbackQuestions.getFallbackBatch(category, 0, BATCH_SIZE);
  }
  if (batch.length === 0) throw new Error("Initial batch generated no valid questions and no fallback");
  const [first, ...rest] = batch;
  return { first: first!, rest };
}

/**
 * Remove run's batch from cache (e.g. when run ends). Idempotent.
 */
export function clearRunBatch(runId: string): void {
  runBatchStore.delete(runId);
}
