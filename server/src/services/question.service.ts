import { createHash } from "crypto";
import { Question } from "../models/Question.js";
import { logger } from "../config/logger.js";
import * as aiService from "./ai.service.js";
import type { AiQuestionPayload } from "../types/question.types.js";

export type { GenerateQuestionInput } from "./ai.service.js";

function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

export async function isQuestionHashSeen(promptHash: string): Promise<boolean> {
  const exists = await Question.exists({ prompt_hash: promptHash }).exec();
  return !!exists;
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
    topic: input.topicPool,
    prompt_hash: promptHash,
    tx_id: opts?.txId,
    nonce: opts?.nonce,
    gameRun: opts?.gameRunId,
  });

  return payload;
}
