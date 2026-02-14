const getBase = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:7000";

export async function apiFetch<T>(
  path: string,
  opts?: RequestInit & { body?: unknown }
): Promise<{ data?: T; status: number; error?: string; paymentRequired?: { amount: string; recipient: string; nonce: string } }> {
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

  const paymentRequired = res.status === 402;
  const json = await res.json().catch(() => ({}));

  if (paymentRequired) {
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
};
export type StopRunResponse = {
  runId: string;
  totalPoints: number;
  completedLevels: number;
  spent: number;
  grossEarnedStx: number;
  netEarnedStx: number;
  profit: number;
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
  createdAt: string;
  updatedAt: string;
};
