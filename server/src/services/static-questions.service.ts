/**
 * Static question pool: always from server/src/data/questions/master.json when present,
 * else per-category JSONs. Practice sets from practice-*.json. Time always 30s (QUESTION_TIME_CAP_SEC).
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { AiQuestionPayload } from "../types/question.types.js";
import { QUESTION_TIME_CAP_SEC } from "../config/tokenomics.js";
import { getCategoryFilename, getCategoriesWithFiles } from "../config/category-files.js";
import { isValidCategory } from "../config/categories.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUESTIONS_DIR = join(__dirname, "../data/questions");
const PRACTICE_DIR = join(__dirname, "../data/questions");
const MASTER_PATH = join(QUESTIONS_DIR, "master.json");

/** Master data keyed by category display name; populated once if master.json exists. */
let masterData: Record<string, RawQuestion[]> | null = null;

function loadMasterOnce(): Record<string, RawQuestion[]> | null {
  if (masterData !== null) return masterData;
  if (!existsSync(MASTER_PATH)) return null;
  try {
    const raw = readFileSync(MASTER_PATH, "utf-8");
    const data = JSON.parse(raw) as Record<string, RawQuestion[]>;
    masterData = typeof data === "object" && data !== null ? data : null;
    return masterData;
  } catch {
    return null;
  }
}

type RawQuestion = {
  level: number;
  question: string;
  options: string[];
  correct_index: number;
  difficulty: number;
  confidence_score: number;
  reason?: string;
  estimated_solve_time_sec?: number;
};

function rawToPayload(raw: RawQuestion): AiQuestionPayload {
  const options = raw.options?.length >= 4
    ? (raw.options.slice(0, 4) as [string, string, string, string])
    : (["A", "B", "C", "D"] as const);
  return {
    question: raw.question,
    options,
    correct_index: Math.max(0, Math.min(3, raw.correct_index ?? 0)),
    difficulty: raw.difficulty ?? 0.1,
    estimated_solve_time_sec: QUESTION_TIME_CAP_SEC,
    confidence_score: raw.confidence_score ?? 0.9,
    ...(raw.reason && { reasoning: raw.reason }),
  };
}

/** Per category: level -> list of payloads (up to 10 per level from JSON). */
const categoryLevelPool: Map<string, Map<number, AiQuestionPayload[]>> = new Map();
/** Practice: category -> list of payloads (2 used per request). */
const practicePool: Map<string, AiQuestionPayload[]> = new Map();

function loadCategoryFile(category: string): RawQuestion[] {
  const filename = getCategoryFilename(category);
  if (!filename) return [];
  const path = join(QUESTIONS_DIR, filename);
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as RawQuestion[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function loadPracticeFile(category: string): RawQuestion[] {
  const filename = getCategoryFilename(category);
  if (!filename) return [];
  const base = filename.replace(".json", "");
  const path = join(PRACTICE_DIR, `practice-${base}.json`);
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as RawQuestion[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function ensureCategoryLoaded(category: string): void {
  if (categoryLevelPool.has(category)) return;
  const master = loadMasterOnce();
  const rawList =
    master && Array.isArray(master[category]) && master[category].length > 0
      ? master[category]!
      : loadCategoryFile(category);
  const byLevel = new Map<number, AiQuestionPayload[]>();
  for (const raw of rawList) {
    const level = Math.max(0, Math.min(9, Math.floor(Number(raw.level) ?? 0)));
    const list = byLevel.get(level) ?? [];
    list.push(rawToPayload(raw));
    byLevel.set(level, list);
  }
  categoryLevelPool.set(category, byLevel);
}

function ensurePracticeLoaded(category: string): void {
  if (practicePool.has(category)) return;
  const rawList = loadPracticeFile(category);
  const list = rawList.map(rawToPayload);
  practicePool.set(category, list);
}

/**
 * Get 10 questions for a run: one per level 0..9, each randomly chosen from that level's pool.
 * If a level has no questions, that level is skipped and we return fewer than 10 (caller should handle).
 */
export function getRunBatch(category: string): AiQuestionPayload[] {
  if (!isValidCategory(category)) return [];
  ensureCategoryLoaded(category);
  const byLevel = categoryLevelPool.get(category)!;
  const batch: AiQuestionPayload[] = [];
  for (let level = 0; level <= 9; level++) {
    const pool = byLevel.get(level);
    if (pool && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      batch.push(pool[idx]!);
    }
  }
  return batch;
}

/**
 * Get one question for a given level from the category pool (for popping from run batch).
 * Used when we already have a run and need the next question at run.level.
 */
export function getQuestionAtLevel(category: string, level: number): AiQuestionPayload | null {
  if (!isValidCategory(category)) return null;
  ensureCategoryLoaded(category);
  const byLevel = categoryLevelPool.get(category)!;
  const pool = byLevel.get(Math.max(0, Math.min(9, level)));
  if (!pool || pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] ?? null;
}

/**
 * Practice mode: return exactly 2 questions for the category from practice set.
 * If no practice file, fall back to 2 random questions from main pool (levels 0-1).
 */
export function getPracticeQuestions(category: string, count: number = 2): AiQuestionPayload[] {
  if (!isValidCategory(category)) return [];
  ensurePracticeLoaded(category);
  let list = practicePool.get(category) ?? [];
  if (list.length === 0) {
    ensureCategoryLoaded(category);
    const byLevel = categoryLevelPool.get(category)!;
    for (const l of [0, 1]) {
      const pool = byLevel.get(l) ?? [];
      list = list.concat(pool);
    }
  }
  if (list.length === 0) return [];
  const take = Math.min(count, list.length);
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, take);
}

/**
 * Check if static pool has enough for a run (at least one question per level 0-9).
 */
export function hasEnoughForRun(category: string): boolean {
  ensureCategoryLoaded(category);
  const byLevel = categoryLevelPool.get(category)!;
  for (let level = 0; level <= 9; level++) {
    const pool = byLevel.get(level);
    if (!pool || pool.length === 0) return false;
  }
  return true;
}

export function getCategoriesWithStaticData(): string[] {
  return getCategoriesWithFiles().filter((c) => hasEnoughForRun(c));
}
