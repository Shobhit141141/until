export type ChallengeStoreEntry = {
  priceMicroStx: bigint;
  recipient: string;
  used: boolean;
  expiresAt: Date;
};

export type PaymentChallengePayload = {
  amount: string;
  recipient: string;
  nonce: string;
};

export type AiQuestionPayload = {
  question: string;
  options: [string, string, string, string];
  correct_index: number;
  difficulty: number;
  estimated_solve_time_sec: number;
  confidence_score: number;
  /** Short explanation of why the correct answer is correct (shown after answer). */
  reasoning?: string;
};

/** Fallback only; use tokenomics getCostMicroStx(difficulty) for 402. */
export const QUESTION_PRICE_MICRO_STX = 1_000n; // 0.001 STX default for difficulty 0
export const CHALLENGE_EXPIRY_MS = 20 * 60 * 1000; // 20 min

/** In-memory only. Never stored in DB. Never sent to client. */
export type RunStateEntry = {
  level: number; // difficulty 0–9
  correctIndex: number;
  expiresAt: Date;
  walletAddress: string;
  completedLevels: number;
  spentMicroStx: bigint;
  totalPoints: number;
  questionDeliveredAt: Date;
  estimatedSolveTimeSec: number;
  /** MongoDB Question ids for this run (audit trail). */
  questionIds: string[];
  /** Category for this run (same for all questions). */
  category: string;
  /** Per-question result: questionId, selectedIndex, points (for run history). */
  questionResults: { questionId: string; selectedIndex: number; points: number }[];
  /** Per delivered question: correctIndex, options, reasoning (for showing correct answer + reasoning on wrong / history). */
  deliveredQuestionInfo: { questionId: string; correctIndex: number; options: string[]; reasoning?: string }[];
}

export const RUN_STATE_TTL_MS = 30 * 60 * 1000; // 30 min
