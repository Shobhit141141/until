"use client";

import { useState, useEffect, useCallback } from "react";
import { request } from "@stacks/connect";
import {
  apiFetch,
  type QuestionResponse,
  type SubmitAnswerCorrect,
  type SubmitAnswerWrong,
  type StopRunResponse,
  type TopUpInfo,
  type TopUpRequiredPayload,
  type CreditsHistoryResponse,
  type CategoriesResponse,
  type RunHistoryResponse,
  type RunHistoryEntry,
  type UserMe,
  Challenge,
} from "@/lib/api";
import { useWallet } from "@/contexts/WalletContext";

const COST_STX_BY_LEVEL = [0.001, 0.002, 0.003, 0.005, 0.007, 0.01, 0.015, 0.02, 0.03, 0.05];
const MIN_WITHDRAW_STX = 0.01;
const MICRO_STX_PER_STX = 1_000_000;
const PREDEFINED_TOP_UPS_STX = [0.05, 0.1, 0.25, 0.5, 1];
const MIN_TOP_UP_STX = 0.001;

type Step =
  | "ready"
  | "topup"
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
  const [creditsStx, setCreditsStx] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [topUpRequired, setTopUpRequired] = useState<TopUpRequiredPayload | null>(null);
  const [creditsHistory, setCreditsHistory] = useState<CreditsHistoryResponse["transactions"]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingAfterTopUp, setPendingAfterTopUp] = useState<{ level: number; runId?: string } | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isGettingQuestion, setIsGettingQuestion] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isStoppingRun, setIsStoppingRun] = useState(false);
  const [topUpAmountStx, setTopUpAmountStx] = useState<number>(0.05);
  const [customTopUpStx, setCustomTopUpStx] = useState("");
  const [showTopUpPanel, setShowTopUpPanel] = useState(false);
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  const [showRunHistory, setShowRunHistory] = useState(false);
  const [isLoadingRunHistory, setIsLoadingRunHistory] = useState(false);
  const [topUpStepCustomStx, setTopUpStepCustomStx] = useState("");

  const costForLevel = (level: number) => COST_STX_BY_LEVEL[Math.max(0, Math.min(level, 9))] ?? 0.001;

  const refreshCreditsBalance = useCallback(() => {
    if (!wallet) return;
    apiFetch<UserMe>(`/users/me?wallet=${encodeURIComponent(wallet)}`).then((res) => {
      if (res.data?.creditsStx != null) setCreditsStx(res.data.creditsStx);
    }).catch(() => {});
  }, [wallet]);

  useEffect(() => {
    if (!wallet) {
      setCreditsStx(0);
      return;
    }
    refreshCreditsBalance();
  }, [wallet, step, refreshCreditsBalance]);

  useEffect(() => {
    if (!wallet) return;
    apiFetch<CategoriesResponse>("/categories")
      .then((res) => res.data?.categories && setCategories(res.data.categories))
      .catch(() => {});
  }, [wallet]);

  useEffect(() => {
    if (step !== "question" || questionStartedAt == null) return;
    const tick = () => setElapsedSec(Math.floor((Date.now() - questionStartedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step, questionStartedAt]);

  /** Try to get next question using credits. On insufficient credits, sets step to topup. */
  const getNextQuestionWithCredits = async (level: number, currentRunId?: string | null) => {
    if (!wallet) return;
    setError(null);
    setIsGettingQuestion(true);
    const body: { walletAddress: string; useCredits: true; difficulty?: number; runId?: string; preferredCategory?: string } = {
      walletAddress: wallet,
      useCredits: true,
    };
    if (currentRunId) body.runId = currentRunId;
    else {
      body.difficulty = level;
      if (selectedCategory) body.preferredCategory = selectedCategory;
    }

    try {
      const res = await apiFetch<QuestionResponse>("/next-question", { method: "POST", body: body as unknown as Record<string, unknown> });

      if (res.status === 402 && res.topUpRequired) {
        setTopUpRequired(res.topUpRequired);
        setPendingAfterTopUp({ level, runId: currentRunId ?? undefined });
        setStep("topup");
        if (res.error) setError(res.error);
        return;
      }
      if (res.status === 402 && res.paymentRequired) {
        setChallenge(res.paymentRequired);
        setStep("pay");
        return;
      }
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.data) {
        setQuestion(res.data);
        setQuestionStartedAt(Date.now());
        setRunId(res.data.runId);
        setDifficulty(res.data.level);
        setStep("question");
        setChallenge(null);
        setTopUpRequired(null);
        setPendingAfterTopUp(null);
      }
    } finally {
      setIsGettingQuestion(false);
    }
  };

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
    setIsSubmittingAnswer(true);
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
      setIsSubmittingAnswer(false);
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
    setIsSubmittingAnswer(false);
  };

  const stopRun = async () => {
    if (!runId || !wallet) {
      setError("Wallet required to stop");
      return;
    }
    setError(null);
    setIsStoppingRun(true);
    const res = await apiFetch<StopRunResponse>("/run/stop", {
      method: "POST",
      body: { runId, walletAddress: wallet },
    });
    setIsStoppingRun(false);
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

  const doTopUpWithWallet = async (amountStx: number, recipient: string) => {
    setError(null);
    setIsToppingUp(true);
    try {
      const amountMicro = String(Math.round(amountStx * MICRO_STX_PER_STX));
      const response = await request("stx_transferStx", {
        amount: amountMicro,
        recipient,
        memo: "",
      });
      const txid = (response as { txid?: string })?.txid;
      if (!txid) {
        setError("Payment failed: no transaction ID");
        setIsToppingUp(false);
        return;
      }
      const doTopUpPost = () =>
        apiFetch<{ creditsStx: number }>("/credits/top-up", { method: "POST", body: { txId: txid } });
      let res = await doTopUpPost();
      if (res.status === 402 && res.error === "Transaction pending") {
        const maxAttempts = 25;
        const intervalMs = 4000;
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise((r) => setTimeout(r, intervalMs));
          res = await doTopUpPost();
          if (res.status === 200 && res.data) break;
          if (res.status === 402 && res.error && res.error !== "Transaction pending") {
            setError(res.error);
            setIsToppingUp(false);
            return;
          }
        }
      }
      if (res.error) {
        setError(res.error ?? "Top-up failed");
        setIsToppingUp(false);
        return;
      }
      refreshCreditsBalance();
      setTopUpRequired(null);
      if (pendingAfterTopUp) {
        await getNextQuestionWithCredits(pendingAfterTopUp.level, pendingAfterTopUp.runId);
        setPendingAfterTopUp(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Top-up cancelled or failed");
    }
    setIsToppingUp(false);
  };

  const handleTopUpFromStep = () => {
    if (!topUpRequired?.recipient) return;
    doTopUpWithWallet(topUpRequired.suggestedAmountStx, topUpRequired.recipient);
  };

  const getEffectiveTopUpAmount = (): number => {
    const custom = parseFloat(customTopUpStx);
    if (Number.isFinite(custom) && custom >= MIN_TOP_UP_STX) return custom;
    return topUpAmountStx;
  };

  const handleStandaloneTopUp = async () => {
    const res = await apiFetch<TopUpInfo>("/credits/top-up-info");
    if (!res.data?.recipient) {
      setError(res.error ?? "Top-up not configured");
      return;
    }
    const amount = getEffectiveTopUpAmount();
    if (amount < MIN_TOP_UP_STX) {
      setError(`Minimum top-up is ${MIN_TOP_UP_STX} STX`);
      return;
    }
    await doTopUpWithWallet(amount, res.data.recipient);
    setShowTopUpPanel(false);
  };

  const loadRunHistory = () => {
    if (!wallet) return;
    setShowRunHistory(true);
    setIsLoadingRunHistory(true);
    apiFetch<RunHistoryResponse>(`/run/history?walletAddress=${encodeURIComponent(wallet)}&limit=20`)
      .then((r) => r.data?.runs && setRunHistory(r.data.runs))
      .catch(() => setRunHistory([]))
      .finally(() => setIsLoadingRunHistory(false));
  };

  const handleWithdraw = async () => {
    if (!wallet) return;
    const amount = parseFloat(withdrawAmount);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAW_STX) {
      setError(`Enter at least ${MIN_WITHDRAW_STX} STX to withdraw`);
      return;
    }
    if (amount > creditsStx) {
      setError("Insufficient credits");
      return;
    }
    setError(null);
    setIsWithdrawing(true);
    const res = await apiFetch<{ creditsStx: number; withdrawnStx: number }>("/credits/withdraw", {
      method: "POST",
      body: { walletAddress: wallet, amountStx: amount },
    });
    setIsWithdrawing(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setWithdrawAmount("");
    refreshCreditsBalance();
  };

  const loadCreditsHistory = () => {
    if (!wallet) return;
    apiFetch<CreditsHistoryResponse>(`/credits/history?walletAddress=${encodeURIComponent(wallet)}&limit=50`).then(
      (r) => r.data?.transactions && setCreditsHistory(r.data.transactions)
    );
    setShowHistory(true);
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

      {/* Credits panel */}
      <div className="rounded border border-zinc-300 dark:border-zinc-600 p-4 flex flex-col gap-3">
        <p className="font-medium text-zinc-800 dark:text-zinc-200">
          Credits: <span className="font-mono">{creditsStx.toFixed(4)}</span> STX
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => setShowTopUpPanel(!showTopUpPanel)}
            disabled={isToppingUp}
            className="rounded bg-foreground text-background px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {isToppingUp ? "Topping up…" : "Top up credits"}
          </button>
          {showTopUpPanel && (
            <div className="flex flex-wrap gap-2 items-center border border-zinc-200 dark:border-zinc-700 rounded p-2 mt-1 w-full">
              <span className="text-xs text-zinc-500 w-full">Predefined:</span>
              {PREDEFINED_TOP_UPS_STX.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => { setTopUpAmountStx(amt); setCustomTopUpStx(""); }}
                  className={`rounded px-2 py-1 text-sm ${topUpAmountStx === amt && !customTopUpStx ? "bg-foreground text-background" : "border"}`}
                >
                  {amt} STX
                </button>
              ))}
              <span className="text-xs text-zinc-500">Custom:</span>
              <input
                type="number"
                min={MIN_TOP_UP_STX}
                step="0.01"
                placeholder="STX"
                value={customTopUpStx}
                onChange={(e) => setCustomTopUpStx(e.target.value)}
                className="rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 w-20 text-sm bg-background"
              />
              <button
                type="button"
                onClick={handleStandaloneTopUp}
                disabled={isToppingUp}
                className="rounded bg-foreground text-background px-2 py-1 text-sm disabled:opacity-50"
              >
                {isToppingUp ? "…" : `Send ${getEffectiveTopUpAmount().toFixed(3)} STX`}
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={MIN_WITHDRAW_STX}
              step="0.01"
              placeholder={`Withdraw (min ${MIN_WITHDRAW_STX})`}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 w-32 text-sm bg-background"
            />
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={isWithdrawing || creditsStx < MIN_WITHDRAW_STX}
              className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {isWithdrawing ? "…" : "Withdraw"}
            </button>
          </div>
          <button type="button" onClick={loadCreditsHistory} className="rounded border px-3 py-1.5 text-sm">
            Transaction history
          </button>
          <button type="button" onClick={loadRunHistory} className="rounded border px-3 py-1.5 text-sm">
            Run history
          </button>
        </div>
        {showHistory && creditsHistory.length > 0 && (
          <div className="mt-2 border-t border-zinc-200 dark:border-zinc-700 pt-2">
            <p className="text-xs font-medium text-zinc-500 mb-1">Recent transactions</p>
            <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
              {creditsHistory.map((tx) => (
                <li key={tx.id} className="flex justify-between gap-2">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {tx.type} {(tx.amountMicroStx / MICRO_STX_PER_STX).toFixed(4)} STX
                  </span>
                  <span className="font-mono">{(tx.balanceAfterMicroStx / MICRO_STX_PER_STX).toFixed(4)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {step === "ready" && (
        <div className="flex flex-col gap-3">
          {categories.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Category (server-only)</label>
              <select
                value={selectedCategory ?? ""}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
                className="rounded border border-zinc-300 dark:border-zinc-600 px-3 py-2 bg-background text-sm max-w-xs"
              >
                <option value="">Random</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={() => getNextQuestionWithCredits(0)}
            disabled={isGettingQuestion}
            className="rounded bg-foreground text-background px-4 py-2 font-medium w-fit disabled:opacity-50 flex items-center gap-2"
          >
            {isGettingQuestion ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                Loading…
              </>
            ) : (
              "Play game (use credits)"
            )}
          </button>
          <p className="text-sm text-zinc-500 max-w-md">
            One top-up, then play from credits. Profit by chaining correct answers, then stop & finish to add profit to your balance.
          </p>
        </div>
      )}

      {step === "topup" && topUpRequired && (
        <div className="flex flex-col gap-3">
          <p className="text-zinc-600 dark:text-zinc-400">
            Insufficient credits. Top up to continue.
            {topUpRequired.creditsStx != null && (
              <> You have {topUpRequired.creditsStx.toFixed(4)} STX.</>
            )}
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-zinc-500">Predefined:</span>
            {PREDEFINED_TOP_UPS_STX.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => doTopUpWithWallet(amt, topUpRequired.recipient)}
                disabled={isToppingUp}
                className="rounded border px-2 py-1 text-sm disabled:opacity-50 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {amt} STX
              </button>
            ))}
            <span className="text-sm text-zinc-500">Custom:</span>
            <input
              type="number"
              min={MIN_TOP_UP_STX}
              step="0.01"
              placeholder="STX"
              value={topUpStepCustomStx}
              onChange={(e) => setTopUpStepCustomStx(e.target.value)}
              className="rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 w-20 text-sm bg-background"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = parseFloat(topUpStepCustomStx);
                  if (Number.isFinite(v) && v >= MIN_TOP_UP_STX) doTopUpWithWallet(v, topUpRequired.recipient);
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                const v = parseFloat(topUpStepCustomStx);
                if (Number.isFinite(v) && v >= MIN_TOP_UP_STX) doTopUpWithWallet(v, topUpRequired.recipient);
              }}
              disabled={isToppingUp || !topUpStepCustomStx}
              className="rounded bg-foreground text-background px-2 py-1 text-sm disabled:opacity-50"
            >
              {isToppingUp ? "…" : "Send custom"}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTopUpFromStep}
              disabled={isToppingUp}
              className="rounded bg-foreground text-background px-4 py-2 font-medium disabled:opacity-50"
            >
              {isToppingUp ? "Confirm in wallet…" : `Send ${topUpRequired.suggestedAmountStx} STX`}
            </button>
            <button
              type="button"
              onClick={() => { setStep("ready"); setTopUpRequired(null); setPendingAfterTopUp(null); setError(null); }}
              className="rounded border px-4 py-2"
            >
              Cancel
            </button>
          </div>
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
              disabled={selectedIndex === null || isSubmittingAnswer}
              className="rounded bg-foreground text-background px-4 py-2 font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmittingAnswer ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  Checking…
                </>
              ) : (
                "Submit answer"
              )}
            </button>
            <button
              type="button"
              onClick={stopRun}
              disabled={isStoppingRun}
              className="rounded border px-4 py-2 disabled:opacity-50 flex items-center gap-2"
            >
              {isStoppingRun ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Finishing…
                </>
              ) : (
                "Stop & finish"
              )}
            </button>
          </div>
        </div>
      )}

      {step === "submitting" && (
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <span className="inline-block w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
          Checking answer…
        </div>
      )}

      {step === "correct" && result && "correct" in result && result.correct && (
        <div className="flex flex-col gap-3">
          <p className="font-medium text-green-700 dark:text-green-400">
            Correct. Level {result.level}, {result.completedLevels} completed.
            {result.totalPoints != null && ` ${result.totalPoints} points.`}
          </p>
          <button
            type="button"
            onClick={() => getNextQuestionWithCredits(result.level, runId)}
            disabled={isGettingQuestion}
            className="rounded bg-foreground text-background px-4 py-2 font-medium w-fit disabled:opacity-50 flex items-center gap-2"
          >
            {isGettingQuestion ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                Loading next…
              </>
            ) : (
              `Next question (−${costForLevel(result.level)} STX from credits)`
            )}
          </button>
          <button type="button" onClick={stopRun} disabled={isStoppingRun} className="rounded border px-4 py-2 w-fit disabled:opacity-50">
            Stop & finish
          </button>
        </div>
      )}

      {step === "wrong" && result && "runEnded" in result && (
        <div className="flex flex-col gap-3">
          <p className="font-medium text-red-700 dark:text-red-400">Wrong. Run ended.</p>
          {"correctOptionText" in result && result.correctOptionText && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Correct answer: <strong>{result.correctOptionText}</strong>
            </p>
          )}
          {"reasoning" in result && result.reasoning && (
            <div className="rounded border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50 dark:bg-zinc-900/50">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Why</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{result.reasoning}</p>
            </div>
          )}
          {result.totalPoints != null && <p>Total points: {result.totalPoints}</p>}
          {result.profit != null && <p>Profit: {result.profit} STX</p>}
          {result.milestoneBonusStx != null && result.milestoneBonusStx > 0 && (
            <p className="text-zinc-600 dark:text-zinc-400">
              Milestone bonus ({result.milestoneTier === "100" ? "100%" : "70%"}): {result.milestoneBonusStx.toFixed(4)} STX
            </p>
          )}
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
            {r.creditsStx != null && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Your credits balance: <strong className="font-mono text-foreground">{r.creditsStx.toFixed(4)}</strong> STX
              </p>
            )}
            <div className="rounded border border-zinc-300 dark:border-zinc-600 p-4 flex flex-col gap-2 text-sm">
              <p className="font-medium text-zinc-700 dark:text-zinc-300">How points and profit were decided</p>
              <ul className="list-none space-y-1 text-zinc-600 dark:text-zinc-400">
                <li>• Total points: <strong className="text-foreground">{r.totalPoints}</strong> (from {r.completedLevels} correct answer{r.completedLevels !== 1 ? "s" : ""}; each = base points × time multiplier)</li>
                <li>• Points → STX: 100 pts = 0.01 STX → earned = <strong className="text-foreground">{r.totalPoints} × 0.0001 = {r.netEarnedStx.toFixed(4)}</strong> STX</li>
                <li>• Spent (questions paid): <strong className="text-foreground">{r.spent.toFixed(4)}</strong> STX</li>
                <li>• Profit: earned − spent = <strong className="text-foreground">{r.profit.toFixed(4)}</strong> STX (added to your credits)</li>
                {r.milestoneBonusStx != null && r.milestoneBonusStx > 0 && (
                  <li>• Milestone bonus ({r.milestoneTier === "100" ? "100%" : "70%"}): <strong className="text-foreground">{r.milestoneBonusStx.toFixed(4)}</strong> STX</li>
                )}
              </ul>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Summary: {r.completedLevels} correct, {r.totalPoints} pts → {r.netEarnedStx.toFixed(4)} STX earned. Spent {r.spent.toFixed(4)} STX. Profit: {r.profit.toFixed(4)} STX.
              {r.milestoneBonusStx != null && r.milestoneBonusStx > 0 && ` Milestone bonus: ${r.milestoneBonusStx.toFixed(4)} STX.`}
            </p>
            <button type="button" onClick={startOver} className="rounded border px-4 py-2 w-fit">
              Play again
            </button>
          </div>
        );
      })()}

      {showRunHistory && (
        <div className="rounded border border-zinc-300 dark:border-zinc-600 p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Run history</h2>
            <button type="button" onClick={() => setShowRunHistory(false)} className="text-sm underline">
              Close
            </button>
          </div>
          {isLoadingRunHistory ? (
            <div className="flex items-center gap-2 text-zinc-500">
              <span className="inline-block w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
              Loading…
            </div>
          ) : runHistory.length === 0 ? (
            <p className="text-sm text-zinc-500">No runs yet. Play a game to see history here.</p>
          ) : (
            <ul className="space-y-4">
              {runHistory.map((run) => (
                <li key={run.runId} className="border border-zinc-200 dark:border-zinc-700 rounded p-3 text-sm">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-600 dark:text-zinc-400 mb-2">
                    <span>{new Date(run.createdAt).toLocaleString()}</span>
                    <span>Score: <strong className="text-foreground">{run.score}</strong></span>
                    <span>Spent: {run.spent.toFixed(4)} STX</span>
                    <span>Earned: {run.earned.toFixed(4)} STX</span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">Questions</summary>
                    <ul className="mt-2 space-y-3 pl-2 border-l-2 border-zinc-200 dark:border-zinc-700">
                      {run.questions.map((q, i) => (
                        <li key={i} className="pl-2">
                          <p className="font-medium text-zinc-800 dark:text-zinc-200">{q.question}</p>
                          <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">
                            Your answer: {q.options[q.selectedIndex] ?? "—"} · Points: {q.points}
                            {q.correctOptionText != null && q.correctOptionText !== (q.options[q.selectedIndex] ?? "—") && (
                              <> · Correct: <strong className="text-zinc-800 dark:text-zinc-200">{q.correctOptionText}</strong></>
                            )}
                          </p>
                          {q.reasoning && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 italic">Why: {q.reasoning}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      )}
    </div>
  );
}
