"use client";

import { useState, useEffect } from "react";
import { request } from "@stacks/connect";
import {
  apiFetch,
  type QuestionResponse,
  type SubmitAnswerCorrect,
  type SubmitAnswerWrong,
  type StopRunResponse,
  Challenge,
} from "@/lib/api";
import { useWallet } from "@/contexts/WalletContext";

type Step =
  | "ready"
  | "pay"
  | "paying"
  | "pending"
  | "question"
  | "submitting"
  | "correct"
  | "wrong"
  | "stopped";

export default function Home() {
  const { address: wallet, isConnecting, connectWallet } = useWallet();
  const [difficulty, setDifficulty] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("ready");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [question, setQuestion] = useState<QuestionResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    | (SubmitAnswerCorrect & { totalPoints?: number })
    | (SubmitAnswerWrong & { totalPoints?: number })
    | StopRunResponse
    | null
  >(null);
  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (step !== "question" || questionStartedAt == null) return;
    const tick = () => setElapsedSec(Math.floor((Date.now() - questionStartedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step, questionStartedAt]);

  const loadChallenge = async (diff: number) => {
    setError(null);
    const res = await apiFetch<unknown>(`/next-question?difficulty=${diff}`);
    if (res.paymentRequired) {
      setChallenge(res.paymentRequired);
      setStep("pay");
      return;
    }
    if (res.error) setError(res.error);
  };

  const submitPaymentAndGetQuestion = async (txIdFromWallet: string) => {
    if (!challenge) return;
    setError(null);
    const body: { txId: string; nonce: string; runId?: string; difficulty?: number } = {
      txId: txIdFromWallet,
      nonce: challenge.nonce,
    };
    if (runId) body.runId = runId;
    else body.difficulty = difficulty;

    const doPost = () =>
      apiFetch<QuestionResponse>("/next-question", {
        method: "POST",
        body: body as unknown as Record<string, unknown>,
      });

    let res = await doPost();

    if (res.status === 402 && res.error === "Transaction pending") {
      setStep("pending");
      const maxAttempts = 30;
      const intervalMs = 4000;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, intervalMs));
        res = await doPost();
        if (res.status === 200 && res.data) {
          setQuestion(res.data);
          setQuestionStartedAt(Date.now());
          setRunId(res.data.runId);
          setDifficulty(res.data.level);
          setStep("question");
          setChallenge(null);
          return;
        }
        if (res.status === 402 && res.error && res.error !== "Transaction pending") {
          setChallenge(null);
          setStep("ready");
          setError(res.error);
          return;
        }
      }
      setChallenge(null);
      setStep("ready");
      setError("Confirmation timed out. Check your wallet; you can try again with a new question.");
      return;
    }

    if (res.status === 402 && res.error) {
      setChallenge(null);
      setStep("ready");
      setError(res.error);
      return;
    }
    if (res.error) {
      setError(res.error);
      setStep("pay");
      return;
    }
    if (res.data) {
      setQuestion(res.data);
      setQuestionStartedAt(Date.now());
      setRunId(res.data.runId);
      setDifficulty(res.data.level);
      setStep("question");
      setChallenge(null);
    }
  };

  const payWithWallet = async () => {
    if (!challenge) return;
    if (!challenge.recipient || !/^S[TP][0-9A-HJ-NP-Za-km-z]{39}$/.test(challenge.recipient)) {
      setError("Server misconfiguration: invalid payment recipient. Set STACKS_RECIPIENT_ADDRESS.");
      return;
    }
    setError(null);
    setStep("paying");
    try {
      // Wallet memo limit is 34 bytes; nonce is 36 chars so send prefix
      const memo = challenge.nonce.slice(0, 34);
      const response = await request("stx_transferStx", {
        amount: challenge.amount,
        recipient: challenge.recipient,
        memo,
      });
      const txid = (response as { txid?: string })?.txid;
      if (!txid) {
        setError("Payment failed: no transaction ID");
        setStep("pay");
        return;
      }
      await submitPaymentAndGetQuestion(txid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment cancelled or failed");
      setStep("pay");
    }
  };

  const submitAnswer = async () => {
    if (!runId || selectedIndex === null) return;
    setStep("submitting");
    setError(null);
    const res = await apiFetch<SubmitAnswerCorrect | SubmitAnswerWrong>(
      "/run/submit-answer",
      {
        method: "POST",
        body: { runId, selectedIndex },
      }
    );
    if (res.error) {
      setError(res.error);
      setStep("question");
      return;
    }
    if (res.data?.correct) {
      setResult(res.data);
      setStep("correct");
      setSelectedIndex(null);
      setQuestion(null);
    } else if (res.data && !res.data.correct) {
      setResult(res.data);
      setStep("wrong");
      setRunId(null);
    }
  };

  const stopRun = async () => {
    if (!runId || !wallet) {
      setError("Wallet required to stop");
      return;
    }
    setError(null);
    const res = await apiFetch<StopRunResponse>("/run/stop", {
      method: "POST",
      body: { runId, walletAddress: wallet },
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.data) {
      setResult(res.data);
      setStep("stopped");
      setRunId(null);
      setQuestion(null);
    }
  };

  const startOver = () => {
    setStep("ready");
    setRunId(null);
    setDifficulty(0);
    setQuestion(null);
    setResult(null);
    setChallenge(null);
    setSelectedIndex(null);
    setError(null);
  };

  const cancelPay = () => {
    setChallenge(null);
    setStep(runId ? "question" : "ready");
    setError(null);
  };

  const microStxToStx = (micro: string) =>
    (Number(micro) / 1_000_000).toFixed(4);

  if (!wallet) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Play</h1>
        <p className="text-zinc-600">
          Connect your wallet to play. Each question requires a small STX payment.
        </p>
        <button
          type="button"
          onClick={connectWallet}
          disabled={isConnecting}
          className="rounded bg-foreground text-background px-4 py-2 font-medium w-fit disabled:opacity-50"
        >
          {isConnecting ? "Connecting…" : "Connect wallet"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Play</h1>

      {step === "ready" && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => loadChallenge(0)}
            className="rounded bg-foreground text-background px-4 py-2 font-medium w-fit"
          >
            Get first question (pay to unlock)
          </button>
          <p className="text-sm text-zinc-500 max-w-md">
            The first question costs more than you can earn back on it alone. Profit by chaining correct answers, then stop & finish to lock in earnings.
          </p>
        </div>
      )}

      {step === "pay" && challenge && (
        <div className="flex flex-col gap-3">
          <p className="text-zinc-600">
            Pay {microStxToStx(challenge.amount)} STX to unlock this question. Your wallet will open to confirm.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={payWithWallet}
              className="rounded bg-foreground text-background px-4 py-2 font-medium"
            >
              Pay with wallet
            </button>
            <button type="button" onClick={cancelPay} className="rounded border px-4 py-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "paying" && (
        <p className="text-zinc-600">Confirm payment in your wallet…</p>
      )}

      {step === "pending" && (
        <p className="text-zinc-600">
          Transaction pending. Waiting for confirmation… (this usually takes a few seconds)
        </p>
      )}

      {step === "question" && question && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-500">
            Level {question.level}
            {question.difficultyLabel && ` · ${question.difficultyLabel}`}
          </p>
          <p className="text-sm text-zinc-500 font-mono">
            Solve time: {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, "0")}
            {question.estimated_solve_time_sec != null && (
              <> · Par: {question.estimated_solve_time_sec}s (faster = more points)</>
            )}
          </p>
          <p className="text-lg font-medium">{question.question}</p>
          <ul className="flex flex-col gap-2">
            {question.options.map((opt, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setSelectedIndex(i)}
                  className={`w-full text-left border rounded px-4 py-2 ${
                    selectedIndex === i
                      ? "border-foreground bg-zinc-100 dark:bg-zinc-800"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitAnswer}
              disabled={selectedIndex === null}
              className="rounded bg-foreground text-background px-4 py-2 font-medium disabled:opacity-50"
            >
              Submit answer
            </button>
            <button
              type="button"
              onClick={stopRun}
              className="rounded border px-4 py-2"
            >
              Stop & finish
            </button>
          </div>
        </div>
      )}

      {step === "submitting" && (
        <p className="text-zinc-600">Checking answer…</p>
      )}

      {step === "correct" && result && "correct" in result && result.correct && (
        <div className="flex flex-col gap-3">
          <p className="font-medium text-green-700 dark:text-green-400">
            Correct. Level {result.level}, {result.completedLevels} completed.
            {result.totalPoints != null && ` ${result.totalPoints} points.`}
          </p>
          <button
            type="button"
            onClick={() => loadChallenge(result.level)}
            className="rounded bg-foreground text-background px-4 py-2 font-medium w-fit"
          >
            Next question (pay for level {result.level})
          </button>
          <button type="button" onClick={stopRun} className="rounded border px-4 py-2 w-fit">
            Stop & finish
          </button>
        </div>
      )}

      {step === "wrong" && result && "runEnded" in result && (
        <div className="flex flex-col gap-3">
          <p className="font-medium text-red-700 dark:text-red-400">Wrong. Run ended.</p>
          {result.totalPoints != null && <p>Total points: {result.totalPoints}</p>}
          {result.profit != null && <p>Profit: {result.profit} STX</p>}
          <button type="button" onClick={startOver} className="rounded border px-4 py-2 w-fit">
            Start over
          </button>
        </div>
      )}

      {step === "stopped" && result && "totalPoints" in result && "grossEarnedStx" in result && "spent" in result && (() => {
        const r = result as StopRunResponse;
        return (
          <div className="flex flex-col gap-4">
            <p className="font-medium">Run finished.</p>
            <div className="rounded border border-zinc-300 dark:border-zinc-600 p-4 flex flex-col gap-2 text-sm">
              <p className="font-medium text-zinc-700 dark:text-zinc-300">How points and profit were decided</p>
              <ul className="list-none space-y-1 text-zinc-600 dark:text-zinc-400">
                <li>• Total points: <strong className="text-foreground">{r.totalPoints}</strong> (from {r.completedLevels} correct answer{r.completedLevels !== 1 ? "s" : ""}; each = base points × time multiplier)</li>
                <li>• Points → STX: 100 pts = 0.01 STX → gross = <strong className="text-foreground">{r.totalPoints} × 0.0001 = {r.grossEarnedStx.toFixed(4)}</strong> STX</li>
                <li>• Platform fee (10%): gross × 0.9 → net earned = <strong className="text-foreground">{r.netEarnedStx.toFixed(4)}</strong> STX</li>
                <li>• Spent (questions paid): <strong className="text-foreground">{r.spent.toFixed(4)}</strong> STX</li>
                <li>• Profit: net − spent = <strong className="text-foreground">{r.profit.toFixed(4)}</strong> STX</li>
              </ul>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Summary: {r.completedLevels} correct, {r.totalPoints} pts → {r.netEarnedStx.toFixed(4)} STX net. Spent {r.spent.toFixed(4)} STX. Profit: {r.profit.toFixed(4)} STX.
            </p>
            <button type="button" onClick={startOver} className="rounded border px-4 py-2 w-fit">
              Play again
            </button>
          </div>
        );
      })()}

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      )}
    </div>
  );
}
