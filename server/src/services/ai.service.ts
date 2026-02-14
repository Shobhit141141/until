/**
 * Segregated AI service: LLM call and response validation only.
 * No DB, no payment, no business rules. Gemini primary, Mistral fallback. Swap provider here without touching question flow.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY, GEMINI_MODEL } from "../config/gemini.js";
import { MISTRAL_API_KEY, MISTRAL_MODEL } from "../config/mistral.js";
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

/** Exported so question service can hash the same prompt used for the LLM call. */
export function buildPrompt(input: GenerateQuestionInput): string {
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

/**
 * Call LLM and return validated question payload. No persistence, no repeat check.
 * Throws on missing config, empty/invalid response, or sanity failure after retries.
 */
export async function generateQuestionContent(
  input: GenerateQuestionInput
): Promise<AiQuestionPayload> {
  const prompt = buildPrompt(input);
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
      return payload;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message;
      const isRateLimit =
        msg.includes("429") ||
        msg.includes("Too Many Requests") ||
        msg.includes("quota") ||
        msg.includes("rate limit");
      if (isRateLimit && attempt < MAX_RETRIES) {
        const retryMatch = msg.match(/retry in (\d+(?:\.\d+)?)\s*ms/i);
        const delayMs = retryMatch ? Math.ceil(Number(retryMatch[1])) : 2000;
        await new Promise((r) => setTimeout(r, Math.min(delayMs, 10000)));
      }
    }
  }
  const geminiError = lastError ?? new Error("Question generation failed after retries");
  if (MISTRAL_API_KEY) {
    try {
      return await generateQuestionContentMistral(input);
    } catch (mistralErr) {
      throw new Error(
        `Gemini: ${geminiError.message}; Mistral fallback: ${mistralErr instanceof Error ? mistralErr.message : String(mistralErr)}`
      );
    }
  }
  throw geminiError;
}

/** Mistral fallback: same prompt/parse/sanity, different API. */
async function generateQuestionContentMistral(
  input: GenerateQuestionInput
): Promise<AiQuestionPayload> {
  const prompt = buildPrompt(input);
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mistral API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty Mistral response");
  const payload = parsePayload(text);
  if (!payload) throw new Error("Invalid JSON from Mistral");
  const fail = sanityCheck(payload, input.previousDifficulty);
  if (fail) throw new Error(`Sanity check: ${fail}`);
  return payload;
}

const BATCH_SIZE = 10;

/** Prompt for generating N questions in one call (array of N JSON objects). */
export function buildBatchPrompt(input: GenerateQuestionInput, count: number): string {
  const { level, topicPool, difficultyScalar, timeLimitSec, seed } = input;
  const seedPart = seed ? `Use deterministic seed: ${seed}.` : "";
  return `Generate exactly ${count} skill-based multiple choice quiz questions. Verifiable facts only, single correct answer per question, no ambiguity. Each question must be distinct.

Topic pool: ${topicPool}
Level: ${level}
Difficulty scalar: ${difficultyScalar}
Time limit for solving (seconds): ${timeLimitSec}
${seedPart}

Respond with ONLY a JSON array of ${count} objects, no markdown, no explanation:
[{"question":"...","options":["A","B","C","D"],"correct_index":0,"difficulty":0.73,"estimated_solve_time_sec":42,"confidence_score":0.91}, ...]
- correct_index is 0-3 per question. difficulty and confidence_score 0-1. estimated_solve_time_sec in [${MIN_SOLVE_TIME_SEC},${MAX_SOLVE_TIME_SEC}].`;
}

function parseBatchPayload(text: string): AiQuestionPayload[] {
  const trimmed = text.trim().replace(/^```json\s*|\s*```$/g, "");
  try {
    const raw = JSON.parse(trimmed);
    if (!Array.isArray(raw)) return [];
    const out: AiQuestionPayload[] = [];
    for (const item of raw) {
      const one = parsePayload(typeof item === "object" && item !== null ? JSON.stringify(item) : String(item));
      if (one) out.push(one);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Generate a batch of questions in one LLM call. Tries Gemini first, then Mistral. Returns only valid payloads passing sanity.
 */
export async function generateQuestionBatch(
  input: GenerateQuestionInput,
  size: number = BATCH_SIZE
): Promise<AiQuestionPayload[]> {
  const prompt = buildBatchPrompt(input, size);
  const tryGemini = async (): Promise<string> => {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) throw new Error("Empty Gemini batch response");
    return text;
  };
  const tryMistral = async (): Promise<string> => {
    if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY not set");
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error(`Mistral ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty Mistral batch response");
    return text;
  };
  let text: string;
  try {
    text = await tryGemini();
  } catch (err) {
    if (MISTRAL_API_KEY) text = await tryMistral();
    else throw err;
  }
  const parsed = parseBatchPayload(text);
  const valid: AiQuestionPayload[] = [];
  for (const p of parsed) {
    if (!sanityCheck(p, input.previousDifficulty)) valid.push(p);
  }
  return valid;
}
