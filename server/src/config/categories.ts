/**
 * Curated question categories (server-side).
 * Same category for the whole run; difficulty via reasoning depth, not obscurity.
 * Rule: if a user can answer by memorization → reject it.
 */

export type CategoryMetadata = {
  description: string;
  rules: string[];
  difficulty_scaling: string;
  example: string;
};

export const CATEGORY_METADATA: Record<string, CategoryMetadata> = {
  "Situational Reasoning": {
    description:
      "Real-life scenarios where the correct answer is derived by logically analyzing constraints and outcomes. Questions feel relatable and practical, and the optimal choice is objectively provable, not opinion-based.",
    rules: [
      "Must represent a realistic situation",
      "Exactly one objectively optimal answer",
      "No opinions or subjective wording",
    ],
    difficulty_scaling:
      "Increase difficulty by adding more constraints, tighter timing, or conflicting priorities.",
    example:
      "Two queues move at different speeds due to order complexity. Choose the faster option based on reasoning.",
  },
  "Attention Traps": {
    description:
      "Questions that reward careful reading and observation. The challenge lies in noticing subtle wording, exclusions, or details that others might overlook.",
    rules: [
      "Answer must be inferable directly from the text",
      "No trick logic or hidden assumptions",
      "Wording precision is key",
    ],
    difficulty_scaling: "Increase density of information and subtlety of wording.",
    example: '"All boxes except one are empty." How many contain something?',
  },
  "Mental Shortcuts": {
    description:
      "Problems designed to be solved quickly by recognizing shortcuts rather than performing full calculations. Encourages intuition and pattern recognition.",
    rules: [
      "Solvable in one mental step",
      "No long arithmetic or formulas",
      "Clear comparison or elimination path",
    ],
    difficulty_scaling: "Use closer comparisons and less obvious shortcuts.",
    example: "Which is larger: 49×2 or 50×2−3?",
  },
  "Cause & Effect": {
    description:
      "Focuses on identifying the immediate, direct consequence of a single change. Tests understanding of simple causal relationships without deep scientific knowledge.",
    rules: [
      "Only one direct effect considered",
      "No long causal chains",
      "Everyday contexts only",
    ],
    difficulty_scaling: "Introduce less obvious but still direct consequences.",
    example: "If everyone sets clocks 10 minutes ahead, what changes first?",
  },
  "Constraint Puzzles": {
    description:
      "Logic puzzles where multiple explicit constraints must all be satisfied. Only one option fits all constraints simultaneously.",
    rules: [
      "All constraints must be explicit",
      "Solvable without guessing",
      "Single valid solution",
    ],
    difficulty_scaling: "Add more constraints or tighter ordering conditions.",
    example: "Given ordering rules for meetings A, B, and C, find a valid sequence.",
  },
  "Elimination Logic": {
    description:
      "Problems solved by systematically ruling out impossible options until only one remains. Encourages structured reasoning.",
    rules: [
      "Each option must be verifiably true or false",
      "No probability or guessing",
      "Clear elimination path",
    ],
    difficulty_scaling: "Increase number of options or interdependencies.",
    example: "Only one of three statements is true—identify which.",
  },
  "Estimation Battles": {
    description:
      "Questions where the goal is to choose the closest or most reasonable estimate, not an exact calculation. Relies on intuition and scale awareness.",
    rules: [
      "Exact calculation unnecessary",
      "Numbers kept intuitive",
      "Clear comparison target",
    ],
    difficulty_scaling: "Use closer ranges or less familiar quantities.",
    example: "Which is closer to one million: 990,000 or 1,050,000?",
  },
  "Ratios in Disguise": {
    description:
      "Ratio and proportion problems framed in everyday language without explicitly mentioning ratios. Tests proportional reasoning intuitively.",
    rules: [
      "No explicit math jargon",
      "Small, intuitive numbers",
      "Real-life framing",
    ],
    difficulty_scaling: "Combine multiple proportional changes.",
    example: "If speed doubles but time halves, how does distance change?",
  },
  "Everyday Science": {
    description:
      "Questions based on observable daily phenomena explained through simple reasoning. No formulas or specialized knowledge required.",
    rules: [
      "Explainable in one sentence",
      "No technical jargon",
      "Based on common experiences",
    ],
    difficulty_scaling: "Use less obvious everyday effects.",
    example: "Why does metal feel colder than wood at the same temperature?",
  },
  "One-Move Puzzles": {
    description:
      "Problems that can be solved by a single correct action or change. Emphasizes insight over extended reasoning.",
    rules: [
      "Single-step solution",
      "Clear before/after state",
      "No multi-step planning",
    ],
    difficulty_scaling: "Make the optimal move less visually obvious.",
    example: "Move one weight to balance a scale.",
  },
  "Patterns and Sequences": {
    description:
      "Pattern-recognition questions involving numbers, words, or symbols. The pattern must be internally consistent and solvable by reasoning.",
    rules: [
      "Consistent internal logic",
      "No obscure sequences",
      "Exactly one continuation fits",
    ],
    difficulty_scaling: "Introduce pattern shifts or multi-layered rules.",
    example: "AB→BC, BC→CD, DE→?",
  },
};

export const QUESTION_CATEGORIES = Object.keys(CATEGORY_METADATA) as readonly string[];

export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

/** Format category metadata for the AI prompt (description, rules, difficulty scaling, example). */
export function getCategoryPromptContext(category: string): string {
  const meta = CATEGORY_METADATA[category];
  if (!meta) return category;
  const rules = meta.rules.map((r) => `- ${r}`).join("\n");
  return [
    meta.description,
    "Rules:",
    rules,
    "Difficulty scaling: " + meta.difficulty_scaling,
    "Example: " + meta.example,
  ].join("\n");
}

export function getRandomCategory(): QuestionCategory {
  const i = Math.floor(Math.random() * QUESTION_CATEGORIES.length);
  return QUESTION_CATEGORIES[i] as QuestionCategory;
}

export function isValidCategory(value: string): value is QuestionCategory {
  return (QUESTION_CATEGORIES as readonly string[]).includes(value);
}
