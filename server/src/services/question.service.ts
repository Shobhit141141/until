import { createHash } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY, GEMINI_MODEL } from "../config/gemini.js";
import { Question } from "../models/Question.js";
import { logger } from "../config/logger.js";
import type { AiQuestionPayload } from "../types/question.types.js";

const MIN_CONFIDENCE = 0.8;
const MIN_SOLVE_TIME_SEC = 10;
const MAX_SOLVE_TIME_SEC = 300;
const MAX_RETRIES = 2;

export type GenerateQuestionInput = {
  level: number;
  topicPool: string;
  difficultyScalar: number;
  timeLimitSec: number;
  previousDifficulty?: number;
  seed?: string;
};

function buildPrompt(input: GenerateQuestionInput): string {
  const { level, topicPool, difficultyScalar, timeLimitSec, previousDifficulty, seed } = input;
  const seedPart = seed ? `Use deterministic seed: ${seed}.` : "";
  const prevPart =
    previousDifficulty != null
      ? `Difficulty must be >= ${previousDifficulty} (no regression).`
      : "";
  return `Generate exactly one skill-based multiple choice quiz question. Verifiable facts only, single correct answer, no ambiguity.

Topic pool: ${topicPool}
Level: ${level}
Difficulty scalar (monotonic): ${difficultyScalar}
Time limit for solving (seconds): ${timeLimitSec}
${prevPart}
${seedPart}

Respond with ONLY a single JSON object, no markdown, no explanation:
{"question":"...","options":["A","B","C","D"],"correct_index":0,"difficulty":0.73,"estimated_solve_time_sec":42,"confidence_score":0.91}
- correct_index is 0-3. difficulty and confidence_score 0-1. estimated_solve_time_sec in [${MIN_SOLVE_TIME_SEC},${MAX_SOLVE_TIME_SEC}].`;
}

function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

function parsePayload(text: string): AiQuestionPayload | null {
  const trimmed = text.trim().replace(/^```json\s*|\s*```$/g, "");
  try {
    const raw = JSON.parse(trimmed) as unknown;
    if (
      typeof raw !== "object" ||
      raw === null ||
      !("question" in raw) ||
      !("options" in raw) ||
      !Array.isArray((raw as { options: unknown }).options) ||
      (raw as { options: unknown[] }).options.length !== 4
    )
      return null;
    const o = raw as Record<string, unknown>;
    const options = o.options as string[];
    const correct_index = Number(o.correct_index);
    if (!Number.isInteger(correct_index) || correct_index < 0 || correct_index > 3)
      return null;
    const difficulty = Number(o.difficulty);
    const estimated_solve_time_sec = Number(o.estimated_solve_time_sec);
    const confidence_score = Number(o.confidence_score);
    if (
      !Number.isFinite(difficulty) ||
      !Number.isFinite(estimated_solve_time_sec) ||
      !Number.isFinite(confidence_score)
    )
      return null;
    return {
      question: String(o.question),
      options: [options[0], options[1], options[2], options[3]],
      correct_index,
      difficulty,
      estimated_solve_time_sec,
      confidence_score,
    };
  } catch {
    return null;
  }
}

function sanityCheck(
  payload: AiQuestionPayload,
  previousDifficulty?: number
): string | null {
  if (payload.confidence_score < MIN_CONFIDENCE)
    return "confidence_score < 0.8";
  if (
    payload.estimated_solve_time_sec < MIN_SOLVE_TIME_SEC ||
    payload.estimated_solve_time_sec > MAX_SOLVE_TIME_SEC
  )
    return "estimated_solve_time_sec out of bounds";
  const unique = new Set(payload.options);
  if (unique.size !== 4) return "duplicate answer patterns";
  if (
    previousDifficulty != null &&
    payload.difficulty < previousDifficulty
  )
    return "difficulty regression";
  return null;
}

export async function isQuestionHashSeen(promptHash: string): Promise<boolean> {
  const exists = await Question.exists({ prompt_hash: promptHash }).exec();
  return !!exists;
}

export async function generateQuestion(
  input: GenerateQuestionInput,
  opts?: { txId?: string; nonce?: string; userId?: import("mongoose").Types.ObjectId; gameRunId?: import("mongoose").Types.ObjectId }
): Promise<AiQuestionPayload> {
  const prompt = buildPrompt(input);
  const promptHash = hashPrompt(prompt);
  logger.info("Question generation", { promptHash, level: input.level });

  if (await isQuestionHashSeen(promptHash)) {
    throw new Error("Repeated question hash - use different seed/params");
  }

  const apiKey = GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      if (!text) {
        lastError = new Error("Empty Gemini response");
        continue;
      }
      const payload = parsePayload(text);
      if (!payload) {
        lastError = new Error("Invalid JSON from Gemini");
        continue;
      }
      const fail = sanityCheck(payload, input.previousDifficulty);
      if (fail) {
        lastError = new Error(`Sanity check: ${fail}`);
        continue;
      }
      await Question.create({
        user: opts?.userId,
        question: payload.question,
        options: payload.options,
        correct_index: payload.correct_index,
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
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error("Question generation failed after retries");
}
