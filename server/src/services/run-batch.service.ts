/**
 * Per-run question batch: in-memory + Redis (when REDIS_URL set).
 * Same category for the run; refill in background when few left. Remove question from cache when used.
 * When Redis is used, batch is persisted so we serve from cache instead of fetching on every request.
 */
import type { AiQuestionPayload } from "../types/question.types.js";
import { RUN_STATE_TTL_MS } from "../types/question.types.js";
import * as runStateService from "./run-state.service.js";
import * as staticQuestions from "./static-questions.service.js";
import { getRedis } from "../config/redis.js";
import { getRandomCategory } from "../config/categories.js";
import { logger } from "../config/logger.js";

const REFILL_THRESHOLD = 6;

const RUN_BATCH_KEY_PREFIX = "run:batch:";
const BATCH_TTL_SEC = Math.floor(RUN_STATE_TTL_MS / 1000);

type RunBatchEntry = {
  category: string;
  questions: AiQuestionPayload[];
};

const runBatchStore = new Map<string, RunBatchEntry>();

function redisKey(runId: string): string {
  return `${RUN_BATCH_KEY_PREFIX}${runId}`;
}

/**
 * Get the category for a run (from run state). Returns undefined if run not found.
 */
export function getCategoryForRun(runId: string): string | undefined {
  const run = runStateService.getRun(runId);
  return run?.category;
}

/**
 * Pop the next question for this run. Returns null if run has no batch or batch empty.
 * Uses Redis when available so we serve from cached batch instead of fetching.
 */
export async function popQuestion(runId: string): Promise<AiQuestionPayload | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.lpop(redisKey(runId));
      if (!raw) {
        const entry = runBatchStore.get(runId);
        if (entry?.questions.length) entry.questions.shift(); // keep memory in sync if it had stale data
        return null;
      }
      const payload = JSON.parse(raw) as AiQuestionPayload;
      const entry = runBatchStore.get(runId);
      if (entry?.questions.length) entry.questions.shift();
      return payload;
    } catch (err) {
      logger.warn("Redis batch pop failed, falling back to memory", { runId: runId.slice(0, 8), err: String(err) });
    }
  }
  const entry = runBatchStore.get(runId);
  if (!entry || entry.questions.length === 0) return null;
  const payload = entry.questions.shift()!;
  if (entry.questions.length === 0) runBatchStore.delete(runId);
  return payload;
}

/**
 * Set the batch for a run (e.g. after first question: store the rest of the initial batch).
 * Overwrites any existing batch for this runId. Persists to Redis when available.
 */
export async function setBatch(runId: string, category: string, questions: AiQuestionPayload[]): Promise<void> {
  if (questions.length === 0) return;
  runBatchStore.set(runId, { category, questions: [...questions] });
  const redis = getRedis();
  const store = redis ? "redis" : "memory";
  if (redis) {
    try {
      const key = redisKey(runId);
      await redis.del(key);
      for (const q of questions) await redis.rpush(key, JSON.stringify(q));
      await redis.expire(key, BATCH_TTL_SEC);
    } catch (err) {
      logger.warn("Redis batch set failed", { runId: runId.slice(0, 8), err: String(err) });
    }
  }
  logger.info("[run-batch] set", { runId: runId.slice(0, 8), category, count: questions.length, store });
}

/**
 * Append questions to the run's batch (refill). No-op if run has no batch yet (use setBatch for first time).
 * Persists to Redis when available.
 */
export async function appendToBatch(runId: string, questions: AiQuestionPayload[]): Promise<void> {
  if (questions.length === 0) return;
  const entry = runBatchStore.get(runId);
  if (!entry) return;
  entry.questions.push(...questions);
  const redis = getRedis();
  const store = redis ? "redis" : "memory";
  if (redis) {
    try {
      const key = redisKey(runId);
      for (const q of questions) await redis.rpush(key, JSON.stringify(q));
      await redis.expire(key, BATCH_TTL_SEC);
    } catch (err) {
      logger.warn("Redis batch append failed", { runId: runId.slice(0, 8), err: String(err) });
    }
  }
  logger.info("[run-batch] append", { runId: runId.slice(0, 8), added: questions.length, store });
}

/**
 * Return how many questions are left in the run's batch. Uses Redis LLEN when available.
 */
export async function getBatchSize(runId: string): Promise<number> {
  const redis = getRedis();
  if (redis) {
    try {
      return await redis.llen(redisKey(runId));
    } catch {
      // fall through to memory
    }
  }
  const entry = runBatchStore.get(runId);
  return entry ? entry.questions.length : 0;
}

/**
 * No-op: questions always come from static JSON; run has fixed size (10 or 2 for practice), no refill.
 */
export function refillRunBatchIfNeeded(_runId: string): void {}

/**
 * Pick a category for a new run (server-side only).
 */
export function pickCategoryForNewRun(): string {
  return getRandomCategory();
}

export type CreateInitialBatchOptions = {
  /** When true, use practice set: only 2 questions for this category. */
  practice?: boolean;
};

/**
 * Initial batch from static JSON only: 10 questions (one per level 0–9) or 2 for practice.
 */
export async function createInitialBatch(
  category: string,
  opts: CreateInitialBatchOptions = {}
): Promise<{ first: AiQuestionPayload; rest: AiQuestionPayload[] }> {
  if (opts.practice) {
    const batch = staticQuestions.getPracticeQuestions(category, 2);
    if (batch.length === 0) throw new Error("No practice questions for category");
    const [first, ...rest] = batch;
    logger.info("[run-batch] initial batch from static (practice)", { category, count: batch.length });
    return { first: first!, rest };
  }
  const batch = staticQuestions.getRunBatch(category);
  if (batch.length === 0) throw new Error("No static questions for category");
  const [first, ...rest] = batch;
  logger.info("[run-batch] initial batch from static", { category, count: batch.length });
  return { first: first!, rest };
}

/**
 * Remove run's batch from cache (e.g. when run ends). Idempotent. Clears Redis when available.
 */
export async function clearRunBatch(runId: string): Promise<void> {
  runBatchStore.delete(runId);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(redisKey(runId));
    } catch (err) {
      logger.warn("Redis batch clear failed", { runId: runId.slice(0, 8), err: String(err) });
    }
  }
}
