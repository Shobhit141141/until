const getBase = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:7000";

export type PaymentRequiredPayload = {
  amount: string;
  recipient: string;
  nonce: string;
};

export type TopUpRequiredPayload = {
  topUp: true;
  suggestedAmountStx: number;
  recipient: string;
  creditsStx?: number;
  requiredStx?: number;
};

export async function apiFetch<T>(
  path: string,
  opts?: Omit<RequestInit, "body"> & { body?: unknown }
): Promise<{
  data?: T;
  status: number;
  error?: string;
  paymentRequired?: PaymentRequiredPayload;
  topUpRequired?: TopUpRequiredPayload;
}> {
  const base = getBase();
  const { body, ...rest } = opts ?? {};
  const res = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...rest.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const is402 = res.status === 402;
  const json = await res.json().catch(() => ({}));

  if (is402) {
    if (json.topUp === true && json.recipient) {
      return {
        status: 402,
        topUpRequired: {
          topUp: true,
          suggestedAmountStx: Number(json.suggestedAmountStx) || 0.05,
          recipient: json.recipient ?? "",
          creditsStx: json.creditsStx,
          requiredStx: json.requiredStx,
        },
        error: json.error,
      };
    }
    return {
      status: 402,
      paymentRequired: {
        amount: json.amount ?? "",
        recipient: json.recipient ?? "",
        nonce: json.nonce ?? "",
      },
      error: json.error,
    };
  }

  if (!res.ok) {
    return {
      status: res.status,
      error: json.error ?? res.statusText,
    };
  }

  return { status: res.status, data: json as T };
}

export type Challenge = { amount: string; recipient: string; nonce: string };
export type QuestionResponse = {
  question: string;
  options: string[];
  difficulty: number;
  difficultyLabel?: string;
  estimated_solve_time_sec: number;
  runId: string;
  level: number;
};
export type SubmitAnswerCorrect = {
  correct: true;
  level: number;
  completedLevels: number;
  totalPoints?: number;
};
export type SubmitAnswerWrong = {
  correct: false;
  runEnded: true;
  completedLevels: number;
  totalPoints?: number;
  spentMicroStx: string;
  runId: string;
  grossEarnedStx?: number;
  netEarnedStx?: number;
  profit?: number;
  milestoneBonusStx?: number;
  milestoneTier?: "70" | "100" | null;
  correctOptionText?: string;
  reasoning?: string;
};
export type StopRunResponse = {
  runId: string;
  totalPoints: number;
  completedLevels: number;
  spent: number;
  grossEarnedStx: number;
  netEarnedStx: number;
  profit: number;
  creditsStx?: number;
  milestoneBonusStx?: number;
  milestoneTier?: "70" | "100" | null;
};
export type LeaderboardEntry = {
  rank: number;
  walletAddress: string;
  username: string | null;
  pfpUrl: string | null;
  bestScore: number;
};
export type UserMe = {
  walletAddress: string;
  username: string | null;
  pfpUrl: string | null;
  totalSpent: number;
  totalEarned: number;
  bestScore: number;
  creditsStx: number;
  createdAt: string;
  updatedAt: string;
};

export type TopUpInfo = {
  recipient: string;
  suggestedAmountMicroStx: number;
  suggestedAmountStx: number;
};

export type CreditTransactionEntry = {
  id: string;
  type: "top_up" | "deduct" | "profit" | "refund" | "withdraw";
  amountMicroStx: number;
  balanceAfterMicroStx: number;
  refTxId?: string;
  refRunId?: string;
  createdAt: string;
};

export type CreditsHistoryResponse = { transactions: CreditTransactionEntry[] };

export type CategoriesResponse = { categories: string[] };

export type RunHistoryQuestion = {
  question: string;
  options: string[];
  level?: number;
  selectedIndex: number;
  points: number;
  correctOptionText?: string;
  reasoning?: string;
};

export type RunHistoryEntry = {
  runId: string;
  createdAt: string;
  score: number;
  spent: number;
  earned: number;
  questions: RunHistoryQuestion[];
};

export type RunHistoryResponse = { runs: RunHistoryEntry[] };
