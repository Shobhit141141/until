/**
 * Map from category display name (QUESTION_CATEGORIES) to JSON filename in data/questions/.
 * Used by static question loader when AI is disconnected.
 */
import { QUESTION_CATEGORIES } from "./categories.js";

export const CATEGORY_TO_FILENAME: Record<string, string> = {
  "Situational Reasoning": "situational-reasoning",
  "Attention Traps": "attention",
  "Mental Shortcuts": "mental-shortcuts",
  "Constraint Puzzles": "constraint",
  "Elimination Logic": "eliminate",
  "Estimation Battles": "estimation",
  "Ratios in Disguise": "ratios",
  "Everyday Science": "everyday-science",
  "One-Move Puzzles": "one-move",
  "Patterns and Sequences": "patterns",
};

export function getCategoryFilename(category: string): string | null {
  const slug = CATEGORY_TO_FILENAME[category];
  return slug ? `${slug}.json` : null;
}

export function getCategoriesWithFiles(): string[] {
  return QUESTION_CATEGORIES.filter((c) => CATEGORY_TO_FILENAME[c]);
}
