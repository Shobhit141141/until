/**
 * Curated question categories (server-side only).
 * Same category for the whole run; difficulty via reasoning depth, not obscurity.
 * Rule: if a user can answer by memorization → reject it.
 */

export const QUESTION_CATEGORIES = [
  "Everyday Logic",
  "Smart Math",
  "How Things Work",
  "Patterns & Sequences",
  "What Would Break?",
  "Fast Thinking",
  "Trade-offs",
  "Minimal Change",
] as const;

export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

/** Playful prompt hints (used in AI prompt). Fun, skill-based, no prior knowledge required. */
export const CATEGORY_STYLE_HINTS: Record<QuestionCategory, string> = {
  "Everyday Logic": "Real-life situations, traps, decisions; single correct answer by reasoning.",
  "Smart Math": "Estimation, ratios, mental models; no formulas or obscure constants.",
  "How Things Work": "Tech, apps, internet, machines; reasoning only, no trivia.",
  "Patterns & Sequences": "Visual or logical patterns, progressions; solvable by reasoning.",
  "What Would Break?": "Systems reasoning, fun edge cases; what breaks if…?",
  "Fast Thinking": "Time-pressure reasoning; still one correct answer.",
  "Trade-offs": "You gain A, lose B — what’s optimal? No opinions.",
  "Minimal Change": "Smallest tweak to make X true; minimal change puzzles.",
};

export function getRandomCategory(): QuestionCategory {
  const i = Math.floor(Math.random() * QUESTION_CATEGORIES.length);
  return QUESTION_CATEGORIES[i];
}

export function isValidCategory(value: string): value is QuestionCategory {
  return (QUESTION_CATEGORIES as readonly string[]).includes(value);
}
