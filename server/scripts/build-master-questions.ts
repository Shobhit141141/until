/**
 * Build master-questions.json from all category JSONs in src/data/questions/.
 * Strips estimated_solve_time_sec (time is capped at 30s in code).
 * Run: npx tsx scripts/build-master-questions.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUESTIONS_DIR = join(__dirname, "../src/data/questions");
const CATEGORY_TO_FILENAME: Record<string, string> = {
  "Situational Reasoning": "situational-reasoning.json",
  "Attention Traps": "attention.json",
  "Mental Shortcuts": "mental-shortcuts.json",
  "Constraint Puzzles": "constraint.json",
  "Elimination Logic": "eliminate.json",
  "Estimation Battles": "estimation.json",
  "Ratios in Disguise": "ratios.json",
  "Everyday Science": "everyday-science.json",
  "One-Move Puzzles": "one-move.json",
  "Patterns and Sequences": "patterns.json",
};

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

function stripEstimatedTime(q: RawQuestion): Omit<RawQuestion, "estimated_solve_time_sec"> {
  const { estimated_solve_time_sec: _, ...rest } = q;
  return rest;
}

const master: Record<string, Omit<RawQuestion, "estimated_solve_time_sec">[]> = {};

for (const [category, filename] of Object.entries(CATEGORY_TO_FILENAME)) {
  const path = join(QUESTIONS_DIR, filename);
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as RawQuestion[];
    const list = Array.isArray(data) ? data.map(stripEstimatedTime) : [];
    master[category] = list;
    console.log(`${category}: ${list.length} questions`);
  } catch (e) {
    console.warn(`Skip ${filename}:`, e instanceof Error ? e.message : e);
  }
}

const outPath = join(QUESTIONS_DIR, "master.json");
writeFileSync(outPath, JSON.stringify(master, null, 0), "utf-8");
console.log(`Wrote ${outPath}`);