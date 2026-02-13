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
};

export const QUESTION_PRICE_MICRO_STX = 1_000_000n; // 1 STX per question default
export const CHALLENGE_EXPIRY_MS = 15 * 60 * 1000; // 15 min
