import { createHash } from "crypto";
import type { Types } from "mongoose";
import { Question } from "../models/Question.js";
import { getRedis } from "../config/redis.js";
import { logger } from "../config/logger.js";
import * as runBatchService from "./run-batch.service.js";
import * as staticQuestions from "./static-questions.service.js";
import { isValidCategory } from "../config/categories.js";
import { QUESTION_TIME_CAP_SEC } from "../config/tokenomics.js";
import type { AiQuestionPayload } from "../types/question.types.js";

const REDIS_USED_QUESTIONS_KEY = "until:used_questions";


/** Stable hash for a question (content identity). Used to dedupe in Redis. */
function questionContentHash(question: string, options: string[]): string {
  const normalized = `${question.trim()}\n${[...options].sort().join("\n")}`;
  return createHash("sha256").update(normalized).digest("hex");
}

/** Check if this question was already used in any run (Redis). No-op if Redis disabled. */
export async function isQuestionUsedInRedis(payload: AiQuestionPayload): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const hash = questionContentHash(payload.question, payload.options ?? []);
  const used = await redis.sismember(REDIS_USED_QUESTIONS_KEY, hash);
  return used === 1;
}

/** Mark question as used so it is never served again. No-op if Redis disabled. */
export async function markQuestionAsUsedInRedis(payload: AiQuestionPayload): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const hash = questionContentHash(payload.question, payload.options ?? []);
  await redis.sadd(REDIS_USED_QUESTIONS_KEY, hash);
  logger.debug("Question marked used in Redis", { hash: hash.slice(0, 12) });
}

export type GetQuestionForRunResult = {
  payload: AiQuestionPayload;
  questionId: string;
  /** Set only for first question (no runId); so controller can createRun(..., category) and setBatch. */
  category?: string;
  restBatch?: AiQuestionPayload[];
};

function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

export async function isQuestionHashSeen(promptHash: string): Promise<boolean> {
  const exists = await Question.exists({ prompt_hash: promptHash }).exec();
  return !!exists;
}

/** Question texts this user has already been asked (any run). Used to avoid repeats across runs. */
export async function getSeenQuestionTextsForUser(userId: Types.ObjectId): Promise<Set<string>> {
  const docs = await Question.find({ user: userId }).select("question").lean().exec();
  const set = new Set<string>();
  for (const d of docs) {
    const q = (d as { question?: string }).question;
    if (typeof q === "string" && q.trim()) set.add(q.trim());
  }
  return set;
}

/**
 * Get a question for a run: from per-run batch (same category). Remove from cache when used.
 * First question (no runId): pick category, create initial batch, return first + restBatch.
 * Later questions (runId): pop from run batch; refill in background when few left.
 * Creates Question doc for audit; never stores correct_index.
 */
export async function getQuestionForRun(
  runId: string | undefined,
  level: number,
  userId: Types.ObjectId,
  seed?: string,
  preferredCategory?: string,
  isPractice?: boolean
): Promise<GetQuestionForRunResult> {
  let payload: AiQuestionPayload;
  let category: string | undefined;
  let restBatch: AiQuestionPayload[] | undefined;
  let runCategory: string | undefined;

  const seenForUser = await getSeenQuestionTextsForUser(userId);

  if (runId) {
    runCategory = runBatchService.getCategoryForRun(runId);
    if (!runCategory) {
      throw new Error("Run not found or expired");
    }
    let popped = await runBatchService.popQuestion(runId);
    if (popped) {
      logger.info("[question] from run batch", { runId: runId.slice(0, 8), level });
    }
    if (!popped) {
      popped = staticQuestions.getQuestionAtLevel(runCategory, level);
      if (popped) logger.info("[question] from static (batch empty)", { runId: runId.slice(0, 8), level });
    }
    if (!popped) {
      throw new Error("No question available for this level");
    }
    let skipAttempts = 0;
    const maxSkipAttempts = 10;
    while (seenForUser.has(popped.question.trim()) && skipAttempts < maxSkipAttempts) {
      skipAttempts++;
      const next = await runBatchService.popQuestion(runId);
      if (next) {
        popped = next;
        continue;
      }
      const fromStatic = staticQuestions.getQuestionAtLevel(runCategory, level);
      if (fromStatic && !seenForUser.has(fromStatic.question.trim())) {
        popped = fromStatic;
        break;
      }
      break;
    }
    while (await isQuestionUsedInRedis(popped)) {
      const next = await runBatchService.popQuestion(runId);
      if (next) {
        popped = next;
        continue;
      }
      const fromStatic = staticQuestions.getQuestionAtLevel(runCategory, level);
      if (fromStatic && !(await isQuestionUsedInRedis(fromStatic))) {
        popped = fromStatic;
        break;
      }
      break;
    }
    payload = popped;
    runBatchService.refillRunBatchIfNeeded(runId);
  } else {
    category = preferredCategory && isValidCategory(preferredCategory)
      ? preferredCategory
      : runBatchService.pickCategoryForNewRun();
    const { first, rest } = await runBatchService.createInitialBatch(category, { practice: isPractice });
    const candidates = [first, ...rest];
    const filtered = candidates.filter((q) => !seenForUser.has(q.question.trim()));
    let idx = 0;
    while (idx < filtered.length && (await isQuestionUsedInRedis(filtered[idx]!))) idx++;
    payload = filtered[idx] ?? first;
    restBatch = filtered.length > idx + 1 ? filtered.slice(idx + 1) : filtered.length === 1 ? [] : rest;
  }

  const topicForDoc = runCategory ?? category;
  const doc = await Question.create({
    user: userId,
    question: payload.question,
    options: payload.options,
    difficulty: payload.difficulty,
    estimated_solve_time_sec: QUESTION_TIME_CAP_SEC,
    confidence_score: payload.confidence_score,
    level,
    topic: topicForDoc ?? "unknown",
  });
  logger.info("[question] for run", { questionId: doc._id.toString(), level, category: topicForDoc });

  // Mark as used in Redis so this question is never served again (no two questions repeated).
  await markQuestionAsUsedInRedis(payload);

  return {
    payload,
    questionId: doc._id.toString(),
    ...(category != null && { category, restBatch }),
  };
}
