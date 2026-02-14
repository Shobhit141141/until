import { createHash } from "crypto";
import type { Types } from "mongoose";
import { Question } from "../models/Question.js";
import { logger } from "../config/logger.js";
import * as aiService from "./ai.service.js";
import * as runBatchService from "./run-batch.service.js";
import { isValidCategory } from "../config/categories.js";
import type { AiQuestionPayload } from "../types/question.types.js";

export type { GenerateQuestionInput } from "./ai.service.js";

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
 * Orchestration: repeat check → AI service → persist (no correct_index in DB).
 * Called only after payment verification (controller responsibility).
 */
export async function generateQuestion(
  input: aiService.GenerateQuestionInput,
  opts?: { txId?: string; nonce?: string; userId?: import("mongoose").Types.ObjectId; gameRunId?: import("mongoose").Types.ObjectId }
): Promise<AiQuestionPayload> {
  const prompt = aiService.buildPrompt(input);
  const promptHash = hashPrompt(prompt);
  logger.info("Question generation", { promptHash, level: input.level });

  if (await isQuestionHashSeen(promptHash)) {
    throw new Error("Repeated question hash - use different seed/params");
  }

  const payload = await aiService.generateQuestionContent(input);

  await Question.create({
    user: opts?.userId,
    question: payload.question,
    options: payload.options,
    difficulty: payload.difficulty,
    estimated_solve_time_sec: payload.estimated_solve_time_sec,
    confidence_score: payload.confidence_score,
    level: input.level,
    topic: input.category,
    prompt_hash: promptHash,
    tx_id: opts?.txId,
    nonce: opts?.nonce,
    gameRun: opts?.gameRunId,
  });

  return payload;
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
  preferredCategory?: string
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
    let popped = runBatchService.popQuestion(runId);
    if (!popped) {
      const baseSeed = seed ?? `run-${runId}-${level}-${Date.now()}`;
      const maxTries = 2;
      let lastErr: Error | null = null;
      for (let tryCount = 0; tryCount < maxTries; tryCount++) {
        const trySeed = tryCount === 0 ? baseSeed : `${baseSeed}-retry-${tryCount}`;
        const input: aiService.GenerateQuestionInput = {
          level,
          category: runCategory,
          timeLimitSec: 120,
          previousDifficulty: level > 0 ? level - 1 : undefined,
          seed: trySeed,
        };
        const prompt = aiService.buildPrompt(input);
        if (await isQuestionHashSeen(hashPrompt(prompt))) {
          lastErr = new Error("Repeated question hash");
          continue;
        }
        try {
          popped = await aiService.generateQuestionContent(input);
          break;
        } catch (err) {
          lastErr = err instanceof Error ? err : new Error(String(err));
        }
      }
      if (!popped) {
        throw lastErr ?? new Error("Question generation failed after retries");
      }
    }
    let skipAttempts = 0;
    const maxSkipAttempts = 10;
    while (seenForUser.has(popped.question.trim()) && skipAttempts < maxSkipAttempts) {
      skipAttempts++;
      const next = runBatchService.popQuestion(runId);
      if (next) {
        popped = next;
        continue;
      }
      const genSeed = `run-${runId}-${level}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const input: aiService.GenerateQuestionInput = {
        level,
        category: runCategory,
        timeLimitSec: 120,
        previousDifficulty: level > 0 ? level - 1 : undefined,
        seed: genSeed,
      };
      if (await isQuestionHashSeen(hashPrompt(aiService.buildPrompt(input)))) break;
      try {
        const generated = await aiService.generateQuestionContent(input);
        if (!seenForUser.has(generated.question.trim())) {
          popped = generated;
          break;
        }
      } catch {
        break;
      }
    }
    payload = popped;
    runBatchService.refillRunBatchIfNeeded(runId);
  } else {
    category = preferredCategory && isValidCategory(preferredCategory)
      ? preferredCategory
      : runBatchService.pickCategoryForNewRun();
    const { first, rest } = await runBatchService.createInitialBatch(category);
    const candidates = [first, ...rest];
    let filtered = candidates.filter((q) => !seenForUser.has(q.question.trim()));
    if (filtered.length === 0) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const genSeed = `init-new-${Date.now()}-${attempt}-${Math.random().toString(36).slice(2, 8)}`;
        const input: aiService.GenerateQuestionInput = { level: 0, category: category!, timeLimitSec: 120, seed: genSeed };
        const prompt = aiService.buildPrompt(input);
        if (await isQuestionHashSeen(hashPrompt(prompt))) continue;
        try {
          const generated = await aiService.generateQuestionContent(input);
          if (!seenForUser.has(generated.question.trim())) {
            filtered = [generated];
            break;
          }
        } catch {
          // ignore, try next
        }
      }
    }
    payload = filtered.length > 0 ? filtered[0]! : first;
    restBatch = filtered.length > 1 ? filtered.slice(1) : filtered.length === 1 ? [] : rest;
  }

  const topicForDoc = runCategory ?? category;
  const doc = await Question.create({
    user: userId,
    question: payload.question,
    options: payload.options,
    difficulty: payload.difficulty,
    estimated_solve_time_sec: payload.estimated_solve_time_sec,
    confidence_score: payload.confidence_score,
    level,
    topic: topicForDoc ?? "unknown",
  });
  logger.info("Question for run", { questionId: doc._id.toString(), level, category: topicForDoc });
  return {
    payload,
    questionId: doc._id.toString(),
    ...(category != null && { category, restBatch }),
  };
}
