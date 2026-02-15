/**
 * Static fallback questions by category and level.
 * Used as last resort when AI cannot produce a valid question (e.g. after retries and refund path).
 * Data: server/src/data/fallback-questions.json (30 questions per category, 3 per level 0–9; some categories have 10).
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { isValidCategory } from "../config/categories.js";
import { QUESTION_TIME_CAP_SEC } from "../config/tokenomics.js";
import type { AiQuestionPayload } from "../types/question.types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type FallbackQuestionRecord = {
  level: number;
  question: string;
  options: string[];
  correct_index: number;
  estimated_solve_time_sec: number;
  difficulty: number;
  confidence_score: number;
  reason?: string;
};

let fallbackByCategory: Record<string, FallbackQuestionRecord[]> | null = null;

function loadFallback(): Record<string, FallbackQuestionRecord[]> {
  if (fallbackByCategory !== null) return fallbackByCategory;
  const path = join(__dirname, "../data/fallback-questions.json");
  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw) as Record<string, FallbackQuestionRecord[]>;
  fallbackByCategory = data;
  return fallbackByCategory;
}

function toPayload(rec: FallbackQuestionRecord): AiQuestionPayload {
  const options = rec.options;
  const opts: [string, string, string, string] =
    options.length >= 4
      ? [options[0], options[1], options[2], options[3]]
      : ["A", "B", "C", "D"];
  return {
    question: rec.question,
    options: opts,
    correct_index: Math.max(0, Math.min(3, rec.correct_index)),
    difficulty: rec.difficulty,
    estimated_solve_time_sec: QUESTION_TIME_CAP_SEC,
    confidence_score: rec.confidence_score ?? 0.9,
    ...(rec.reason && { reasoning: rec.reason }),
  };
}

/**
 * Get one fallback question for (category, level). Returns null if category invalid or no questions for that level.
 */
export function getFallbackPayload(category: string, level: number): AiQuestionPayload | null {
  if (!isValidCategory(category)) return null;
  const data = loadFallback();
  const list = data[category];
  if (!list || list.length === 0) return null;
  const forLevel = list.filter((q) => q.level === level);
  if (forLevel.length === 0) return null;
  const pick = forLevel[Math.floor(Math.random() * forLevel.length)]!;
  return toPayload(pick);
}

/**
 * Get up to `count` fallback questions for category at levels startLevel, startLevel+1, … .
 * Used when AI batch fails (e.g. createInitialBatch). Returns fewer if not enough in JSON.
 */
export function getFallbackBatch(
  category: string,
  startLevel: number,
  count: number
): AiQuestionPayload[] {
  if (!isValidCategory(category)) return [];
  const data = loadFallback();
  const list = data[category];
  if (!list || list.length === 0) return [];
  const out: AiQuestionPayload[] = [];
  for (let i = 0; i < count; i++) {
    const level = startLevel + i;
    const forLevel = list.filter((q) => q.level === level);
    if (forLevel.length === 0) continue;
    const pick = forLevel[Math.floor(Math.random() * forLevel.length)]!;
    out.push(toPayload(pick));
  }
  return out;
}
