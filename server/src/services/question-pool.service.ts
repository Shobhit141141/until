/**
 * Optional in-memory pool of pre-generated questions (e.g. fallback). Not used by per-run batch flow.
 * Refilled with a random category; kept for compatibility.
 */
import type { AiQuestionPayload } from "../types/question.types.js";
import * as aiService from "./ai.service.js";
import { getRandomCategory } from "../config/categories.js";
import { logger } from "../config/logger.js";

const POOL_REFILL_THRESHOLD = 5;
/** Match run-batch: 20–25 questions of increasing difficulty. */
const BATCH_SIZE = 25;

type PoolEntry = { payload: AiQuestionPayload; level: number };

const pool: PoolEntry[] = [];
let refillPromise: Promise<void> | null = null;

function shouldRefill(): boolean {
  return pool.length < POOL_REFILL_THRESHOLD;
}

/**
 * Refill pool with one batch. Uses random category and startLevel 0.
 */
async function refillPool(): Promise<void> {
  const category = getRandomCategory();
  const input: aiService.GenerateBatchInput = {
    category,
    startLevel: 0,
    count: BATCH_SIZE,
    seed: `pool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  try {
    const batch = await aiService.generateQuestionBatch(input, BATCH_SIZE);
    for (let i = 0; i < batch.length; i++) {
      pool.push({ payload: batch[i], level: input.startLevel + i });
    }
    logger.info(`Question pool refilled: +${batch.length}, pool size=${pool.length}`);
  } catch (err) {
    logger.error("Question pool refill failed", err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/**
 * Ensure pool has at least one question (refill if needed). Idempotent; only one refill in flight.
 */
export async function ensurePool(): Promise<void> {
  if (pool.length >= POOL_REFILL_THRESHOLD) return;
  if (refillPromise) {
    await refillPromise;
    return;
  }
  refillPromise = refillPool();
  try {
    await refillPromise;
  } finally {
    refillPromise = null;
  }
}

/**
 * Take one question from the pool, optionally preferring a given level. Refills if empty.
 * Returns null only if refill fails and pool is empty.
 */
export async function takeFromPool(preferLevel?: number): Promise<AiQuestionPayload | null> {
  await ensurePool();
  if (pool.length === 0) return null;
  let index = 0;
  if (preferLevel != null) {
    const match = pool.findIndex((e) => e.level === preferLevel);
    if (match >= 0) index = match;
  }
  const entry = pool.splice(index, 1)[0];
  if (!entry) return null;
  if (shouldRefill()) refillPool().catch(() => {});
  return entry.payload;
}

/**
 * Current pool size (for logging/debug).
 */
export function getPoolSize(): number {
  return pool.length;
}
