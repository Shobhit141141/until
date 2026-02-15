"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { request } from "@stacks/connect";
import {
  apiFetch,
  type QuestionResponse,
  type SubmitAnswerCorrect,
  type SubmitAnswerWrong,
  type StopRunResponse,
  type TopUpRequiredPayload,
  type CreditsHistoryResponse,
  type CategoriesResponse,
  type RunHistoryResponse,
  type RunHistoryEntry,
  type UserMe,
  Challenge,
} from "@/lib/api";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/Button";
import {
  HomeScreen,
  QuizLoader,
  TopUpScreen,
  QuestionScreen,
  FeedbackCorrect,
  FeedbackWrong,
  ContinueOrStopScreen,
  RunSummaryScreen,
  CreditsScreen,
  ProfileModal,
} from "@/components/screens";
import { Modal } from "@/components/ui/Modal";
import { QUESTION_TIME_CAP_SEC } from "@/lib/tokenomics";
import toast from "react-hot-toast";

const COST_STX_BY_LEVEL = [0.72, 1.44, 2.16, 2.88, 4.32, 6.48, 9.36, 12.96, 17.28, 22.32];
const MIN_LEVEL_BEFORE_STOP = 4;
const MIN_WITHDRAW_STX = 0.01;
const MICRO_STX_PER_STX = 1_000_000;
/** Tokenomics-aligned: 1 question, 3 questions, 5 questions, full 10-level run. */
const PREDEFINED_TOP_UPS_STX = [
  COST_STX_BY_LEVEL[0],
  COST_STX_BY_LEVEL[0] + COST_STX_BY_LEVEL[1] + COST_STX_BY_LEVEL[2],
  COST_STX_BY_LEVEL.slice(0, 5).reduce((a, b) => a + b, 0),
  COST_STX_BY_LEVEL.reduce((a, b) => a + b, 0),
];
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
  const { address: wallet, connectWallet } = useWallet();
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [pendingAfterTopUp, setPendingAfterTopUp] = useState<{ level: number; runId?: string } | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isGettingQuestion, setIsGettingQuestion] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isStoppingRun, setIsStoppingRun] = useState(false);
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  const [showRunHistory, setShowRunHistory] = useState(false);
  const [isLoadingRunHistory, setIsLoadingRunHistory] = useState(false);
  const [topUpStepCustomStx, setTopUpStepCustomStx] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);
  const [completedLevelsInRun, setCompletedLevelsInRun] = useState(0);
  const [isPracticeRun, setIsPracticeRun] = useState(false);
  const [showCreditsView, setShowCreditsView] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [user, setUser] = useState<UserMe | null>(null);
  const [showQuizLoader, setShowQuizLoader] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);
  /** Per-level breakdown (level index, time taken sec, points earned) for run summary. */
  const [levelBreakdown, setLevelBreakdown] = useState<{ level: number; timeTakenSec: number; allowedSec: number; points: number }[]>([]);
  const previousTotalPointsRef = useRef(0);
  const timeoutFiredRef = useRef(false);
  /** Incremented on each next-question fetch; used to ignore stale responses (e.g. double-click). */
  const nextQuestionFetchIdRef = useRef(0);
  /** Synced on every option click so submit always has the latest selection (avoids stale closure). */
  const selectedIndexRef = useRef<number | null>(null);
  /** When quiz loader was shown; used to enforce min display time. */
  const quizLoaderShownAtRef = useRef<number | null>(null);

  const costForLevel = (level: number) => COST_STX_BY_LEVEL[Math.max(0, Math.min(level, 9))] ?? 0.72;

  const refreshCreditsBalance = useCallback(async () => {
    if (!wallet) return;
    const res = await apiFetch<UserMe>(`/users/me?wallet=${encodeURIComponent(wallet)}`).catch(
      (): { data?: UserMe } => ({})
    );
    if (res && res.data) {
      setCreditsStx(res.data.creditsStx);
      setUser(res.data);
    }
  }, [wallet]);

  // Refresh credits only when wallet connects; after balance-changing actions we call refreshCreditsBalance() explicitly (avoids bombarding /users/me on every step change)
  useEffect(() => {
    if (!wallet) {
      setCreditsStx(0);
      return;
    }
    refreshCreditsBalance();
  }, [wallet, refreshCreditsBalance]);

  useEffect(() => {
    if (!wallet) return;
    apiFetch<CategoriesResponse>("/categories")
      .then((res) => res.data?.categories && setCategories(res.data.categories))
      .catch(() => {});
  }, [wallet]);

  // Open run history / credits from sidebar when navigating with ?open=...
  useEffect(() => {
    const open = searchParams.get("open");
    if (open === "runHistory") {
      setShowRunHistory(true);
      router.replace("/", { scroll: false });
    } else if (open === "credits") {
      setShowCreditsModal(true);
      router.replace("/", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (step !== "question" || questionStartedAt == null) return;
    timeoutFiredRef.current = false;
    const tick = () => setElapsedSec(Math.floor((Date.now() - questionStartedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step, questionStartedAt]);

  /** When time runs out (30s cap), auto-end quiz: submit and end run. Never use API estimated_solve_time. */
  useEffect(() => {
    if (step !== "question" || !question || timeoutFiredRef.current) return;
    if (elapsedSec >= QUESTION_TIME_CAP_SEC) {
      timeoutFiredRef.current = true;
      submitAnswer(true);
    }
  }, [step, question, elapsedSec]);

  /** Try to get next question using credits. On insufficient credits, sets step to topup. */
  const getNextQuestionWithCredits = async (
    level: number,
    currentRunId?: string | null,
    preferredCategoryOverride?: string | null
  ) => {
    if (!wallet) return;
    setError(null);
    setIsGettingQuestion(true);
    const fetchId = ++nextQuestionFetchIdRef.current;
    const category = preferredCategoryOverride ?? selectedCategory;
    const body: { walletAddress: string; useCredits: true; difficulty?: number; runId?: string; preferredCategory?: string } = {
      walletAddress: wallet,
      useCredits: true,
    };
    if (currentRunId) body.runId = currentRunId;
    else {
      body.difficulty = level;
      if (category) body.preferredCategory = category;
    }

    try {
      const res = await apiFetch<QuestionResponse>("/next-question", { method: "POST", body: body as unknown as Record<string, unknown> });

      if (fetchId !== nextQuestionFetchIdRef.current) return;

      if (res.status === 402 && res.topUpRequired) {
        setTopUpRequired(res.topUpRequired);
        setPendingAfterTopUp({ level, runId: currentRunId ?? undefined });
        setStep("topup");
        if (res.error) {
          setError(res.error);
          toast.error(res.error);
        }
        return;
      }
      if (res.status === 402 && res.paymentRequired) {
        setChallenge(res.paymentRequired);
        setStep("pay");
        return;
      }
      if (res.error) {
        const msg = res.betaLimit
          ? "This category has reached its play limit. Currently in beta—try another category."
          : res.error;
        setError(msg);
        toast.error(msg);
        return;
      }
      if (res.data) {
        selectedIndexRef.current = null;
        setSelectedIndex(null);
        setQuestion(res.data);
        setQuestionStartedAt(Date.now());
        if (!runId) setCompletedLevelsInRun(0);
        setRunId(res.data.runId);
        setDifficulty(res.data.level);
        setStep("question");
        setChallenge(null);
        setTopUpRequired(null);
        setPendingAfterTopUp(null);
        setIsPracticeRun(false);
      }
    } finally {
      if (fetchId === nextQuestionFetchIdRef.current) setIsGettingQuestion(false);
    }
  };

  /** Practice mode: no tokenomics, no payment, no credits. Same gameplay. */
  const getNextQuestionWithPractice = async (
    level: number,
    currentRunId?: string | null,
    preferredCategoryOverride?: string | null
  ) => {
    if (!wallet) return;
    setError(null);
    setIsGettingQuestion(true);
    const fetchId = ++nextQuestionFetchIdRef.current;
    const category = preferredCategoryOverride ?? selectedCategory;
    const body: { walletAddress: string; practice: true; difficulty?: number; runId?: string; preferredCategory?: string } = {
      walletAddress: wallet,
      practice: true,
    };
    if (currentRunId) body.runId = currentRunId;
    else {
      body.difficulty = level;
      if (category) body.preferredCategory = category;
    }
    try {
      const res = await apiFetch<QuestionResponse>("/next-question", { method: "POST", body: body as unknown as Record<string, unknown> });
      if (fetchId !== nextQuestionFetchIdRef.current) return;
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      if (res.data) {
        selectedIndexRef.current = null;
        setSelectedIndex(null);
        setQuestion(res.data);
        setQuestionStartedAt(Date.now());
        if (!currentRunId) setCompletedLevelsInRun(0);
        setRunId(res.data.runId);
        setDifficulty(res.data.level);
        setStep("question");
        setChallenge(null);
        setTopUpRequired(null);
        setIsPracticeRun(!!res.data.practice);
      }
    } finally {
      if (fetchId === nextQuestionFetchIdRef.current) setIsGettingQuestion(false);
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
    if (res.error) {
      setError(res.error);
      toast.error(res.error);
    }
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
          selectedIndexRef.current = null;
          setSelectedIndex(null);
          setQuestion(res.data);
          setQuestionStartedAt(Date.now());
          if (!runId) setCompletedLevelsInRun(0);
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
          toast.error(res.error);
          return;
        }
      }
      setChallenge(null);
      setStep("ready");
      const timeoutMsg = "Confirmation timed out. Check your wallet; you can try again with a new question.";
      setError(timeoutMsg);
      toast.error(timeoutMsg);
      return;
    }

    if (res.status === 402 && res.error) {
      setChallenge(null);
      setStep("ready");
      setError(res.error);
      toast.error(res.error);
      return;
    }
    if (res.error) {
      setError(res.error);
      toast.error(res.error);
      setStep("pay");
      return;
    }
    if (res.data) {
      selectedIndexRef.current = null;
      setSelectedIndex(null);
      setQuestion(res.data);
      setQuestionStartedAt(Date.now());
      if (!runId) setCompletedLevelsInRun(0);
      setRunId(res.data.runId);
      setDifficulty(res.data.level);
      setStep("question");
      setChallenge(null);
    }
  };

  const payWithWallet = async () => {
    if (!challenge) return;
    if (!challenge.recipient || !/^S[TP][0-9A-HJ-NP-Za-km-z]{39}$/.test(challenge.recipient)) {
      const msg = "Server misconfiguration: invalid payment recipient. Set STACKS_RECIPIENT_ADDRESS.";
      setError(msg);
      toast.error(msg);
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
        toast.error("Payment failed: no transaction ID");
        setStep("pay");
        return;
      }
      await submitPaymentAndGetQuestion(txid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment cancelled or failed";
      setError(msg);
      toast.error(msg);
      setStep("pay");
    }
  };

  const submitAnswer = async (isTimeout = false, explicitIndex?: number) => {
    const indexToSend = isTimeout ? -1 : (explicitIndex ?? selectedIndexRef.current ?? selectedIndex);
    if (!wallet || !runId) return;
    if (!isTimeout && (indexToSend === null || indexToSend === undefined)) return;
    setStep("submitting");
    setError(null);
    setIsSubmittingAnswer(true);
    const res = await apiFetch<SubmitAnswerCorrect | SubmitAnswerWrong>(
      "/run/submit-answer",
      {
        method: "POST",
        body: {
          runId,
          walletAddress: wallet,
          ...(isTimeout ? { timedOut: true, selectedIndex: -1 } : { selectedIndex: indexToSend ?? 0 }),
        },
      }
    );
    if (res.error) {
      setError(res.error);
      toast.error(res.error);
      setStep("question");
      setIsSubmittingAnswer(false);
      return;
    }
    if (res.data?.correct) {
      const totalNow = res.data.totalPoints ?? 0;
      const pointsThisLevel = totalNow - previousTotalPointsRef.current;
      setLevelBreakdown((prev) => [
        ...prev,
        { level: difficulty, timeTakenSec: elapsedSec, allowedSec: QUESTION_TIME_CAP_SEC, points: pointsThisLevel },
      ]);
      previousTotalPointsRef.current = totalNow;
      setResult(res.data);
      setCompletedLevelsInRun(res.data.completedLevels);
      setStep("correct");
      selectedIndexRef.current = null;
      setSelectedIndex(null);
      setQuestion(null);
      refreshCreditsBalance();
    } else if (res.data && !res.data.correct) {
      setResult(res.data);
      setStep("wrong");
      setRunId(null);
      setCompletedLevelsInRun(0);
      setIsPracticeRun(false);
      if (res.data.creditsStx != null) setCreditsStx(res.data.creditsStx);
      refreshCreditsBalance();
    }
    setIsSubmittingAnswer(false);
  };

  const stopRun = async (opts?: { forceStopBeforeMinLevel?: boolean; abort?: boolean }) => {
    if (!runId || !wallet) {
      setError("Wallet required to stop");
      toast.error("Wallet required to stop");
      return;
    }
    setError(null);
    setIsStoppingRun(true);
    const body: { runId: string; walletAddress: string; forceStopBeforeMinLevel?: boolean; abort?: boolean } = {
      runId,
      walletAddress: wallet,
    };
    if (opts?.forceStopBeforeMinLevel) body.forceStopBeforeMinLevel = true;
    if (opts?.abort) body.abort = true;
    const res = await apiFetch<StopRunResponse>("/run/stop", { method: "POST", body });
    setIsStoppingRun(false);
    if (res.error) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    if (res.data) {
      if (res.data.aborted) {
        setStep("ready");
        setRunId(null);
        setQuestion(null);
        setResult(null);
        setTopUpRequired(null);
        setPendingAfterTopUp(null);
        setCompletedLevelsInRun(0);
        setIsPracticeRun(false);
        if (res.data.creditsStx != null) setCreditsStx(res.data.creditsStx);
        refreshCreditsBalance();
        return;
      }
      setResult(res.data);
      setStep("stopped");
      setRunId(null);
      setQuestion(null);
      setCompletedLevelsInRun(0);
      setIsPracticeRun(false);
      if (res.data.creditsStx != null) setCreditsStx(res.data.creditsStx);
      refreshCreditsBalance();
    }
  };

  const startOver = () => {
    setStep("ready");
    setRunId(null);
    setDifficulty(0);
    setQuestion(null);
    setResult(null);
    setChallenge(null);
    selectedIndexRef.current = null;
    setSelectedIndex(null);
    setError(null);
    setCompletedLevelsInRun(0);
    setLevelBreakdown([]);
    previousTotalPointsRef.current = 0;
    setIsPracticeRun(false);
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
        toast.error("Payment failed: no transaction ID");
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
            toast.error(res.error);
            setIsToppingUp(false);
            return;
          }
        }
      }
      if (res.error) {
        const topUpErr = res.error ?? "Top-up failed";
        setError(topUpErr);
        toast.error(topUpErr);
        setIsToppingUp(false);
        return;
      }
      if (res.data?.creditsStx != null) setCreditsStx(res.data.creditsStx);
      await refreshCreditsBalance();
      setTopUpRequired(null);
      if (pendingAfterTopUp) {
        await getNextQuestionWithCredits(pendingAfterTopUp.level, pendingAfterTopUp.runId);
        setPendingAfterTopUp(null);
      } else {
        toast.success("Credits added.");
        setStep("ready");
        router.push("/profile");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Top-up cancelled or failed";
      setError(msg);
      toast.error(msg);
    }
    setIsToppingUp(false);
  };

  const handleTopUpFromStep = () => {
    if (!topUpRequired?.recipient) return;
    doTopUpWithWallet(topUpRequired.suggestedAmountStx, topUpRequired.recipient);
  };

  const loadRunHistory = useCallback(() => {
    if (!wallet) return;
    setIsLoadingRunHistory(true);
    apiFetch<RunHistoryResponse>(`/run/history?walletAddress=${encodeURIComponent(wallet)}&limit=20`)
      .then((r) => r.data?.runs && setRunHistory(r.data.runs))
      .catch(() => setRunHistory([]))
      .finally(() => setIsLoadingRunHistory(false));
  }, [wallet]);

  const openRunHistory = () => {
    setShowRunHistory(true);
    loadRunHistory();
  };

  useEffect(() => {
    if (!wallet) return;
    loadRunHistory();
  }, [wallet, loadRunHistory]);

  const handleWithdraw = async () => {
    if (!wallet) return;
    const amount = parseFloat(withdrawAmount);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAW_STX) {
      toast.error(`Enter at least ${MIN_WITHDRAW_STX} STX to withdraw`);
      return;
    }
    if (amount > creditsStx) {
      toast.error("Insufficient credits");
      return;
    }
    setError(null);
    setIsWithdrawing(true);
    const res = await apiFetch<{ creditsStx: number; withdrawnStx: number; txId?: string; message?: string }>("/credits/withdraw", {
      method: "POST",
      body: { walletAddress: wallet, amountStx: amount },
    });
    setIsWithdrawing(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setWithdrawAmount("");
    if (res.data?.creditsStx != null) setCreditsStx(res.data.creditsStx);
    refreshCreditsBalance();
    toast.success(res.data?.message ?? `Sent ${res.data?.withdrawnStx} STX to your wallet.`);
    setWithdrawSuccess(res.data?.message ?? `Sent ${res.data?.withdrawnStx} STX to your wallet.`);
    if (res.data?.txId) {
      const base = process.env.NEXT_PUBLIC_STACKS_EXPLORER_URL ?? "https://explorer.hiro.so";
      const isTestnet = base.includes("testnet");
      const path = isTestnet ? `/txid/STACKS_TESTNET/${res.data.txId}` : `/txid/${res.data.txId}`;
      setWithdrawSuccess(`${res.data.message ?? `Sent ${res.data.withdrawnStx} STX.`} View on explorer: ${base.replace(/\/$/, "")}${path}`);
    }
    window.setTimeout(() => setWithdrawSuccess(null), 12000);
  };

  const loadCreditsHistory = useCallback(() => {
    if (!wallet) return;
    apiFetch<CreditsHistoryResponse>(`/credits/history?walletAddress=${encodeURIComponent(wallet)}&limit=50`).then(
      (r) => r.data?.transactions && setCreditsHistory(r.data.transactions)
    );
  }, [wallet]);

  const openCreditsModal = () => {
    setShowCreditsModal(true);
    loadCreditsHistory();
  };

  /** From credits modal: fetch top-up info and show TopUpScreen (voluntary add credits). */
  const openAddCreditsFromModal = async () => {
    setShowCreditsModal(false);
    const res = await apiFetch<{ recipient: string; suggestedAmountStx: number }>("/credits/top-up-info");
    if (res.error || !res.data?.recipient) {
      toast.error(res.error ?? "Could not load top-up info");
      return;
    }
    setTopUpRequired({
      topUp: true,
      recipient: res.data.recipient,
      suggestedAmountStx: res.data.suggestedAmountStx ?? 0.05,
      creditsStx,
    });
    setPendingAfterTopUp(null);
    setStep("topup");
  };

  const openCreditsView = () => {
    setShowCreditsView(true);
    loadCreditsHistory();
  };

  const microStxToStx = (micro: string) =>
    (Number(micro) / 1_000_000).toFixed(4);

  const mainContent = () => {
    if (!wallet) {
      if (step === "ready" && !showCreditsView && !showRunHistory) {
        return (
          <>
            <HomeScreen
              creditsStx={0}
              totalSpent={0}
              totalEarned={0}
              bestScore={0}
              categories={categories}
              selectedCategory={selectedCategory}
              practiceMode={practiceMode}
              onPracticeModeChange={() => {
                toast("Please log in to play.");
                connectWallet();
              }}
              onCategoryClick={() => {
                toast("Please log in to play.");
                connectWallet();
              }}
              hideStats
            />
          </>
        );
      }
      return null;
    }

    if (step === "ready" && showCreditsView) {
      return (
        <div className="space-y-4">
          <CreditsScreen
            balanceStx={creditsStx}
            minWithdrawStx={MIN_WITHDRAW_STX}
            withdrawAmount={withdrawAmount}
            onWithdrawAmountChange={setWithdrawAmount}
            onWithdraw={handleWithdraw}
            isWithdrawing={isWithdrawing}
            transactions={creditsHistory}
            onClose={() => setShowCreditsView(false)}
          />
        </div>
      );
    }

    if (step === "ready" && showRunHistory) {
      return (
        <div className="border-2 border-gray-800 bg-white p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Run history</h2>
            <button
              type="button"
              onClick={() => setShowRunHistory(false)}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Close
            </button>
          </div>
          {isLoadingRunHistory ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : runHistory.length === 0 ? (
            <p className="text-sm text-gray-500">No runs yet.</p>
          ) : (
            <ul className="space-y-4">
              {runHistory.map((run) => (
                <li key={run.runId} className="border-2 border-gray-200 p-3 text-sm">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-600 mb-2">
                    <span>{new Date(run.createdAt).toLocaleString()}</span>
                    <span>Score: <strong className="text-gray-900">{run.score}</strong></span>
                    <span>Spent: {run.spent.toFixed(4)} STX</span>
                    <span>Earned: {run.earned.toFixed(4)} STX</span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium text-gray-900">Questions</summary>
                    <ul className="mt-2 space-y-3 pl-2 border-l-2 border-gray-300">
                      {run.questions.map((q, i) => (
                        <li key={i} className="pl-2">
                          <p className="font-medium text-gray-900">{q.question}</p>
                          <p className="text-gray-600 mt-0.5">
                            Your answer: {q.options[q.selectedIndex] ?? "—"} · Points: {q.points}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    if (step === "ready" && !showCreditsView && !showRunHistory) {
      return (
        <>
          <HomeScreen
            creditsStx={creditsStx}
            totalSpent={user?.totalSpent ?? 0}
            totalEarned={user?.totalEarned ?? 0}
            bestScore={user?.bestScore ?? 0}
            categories={categories}
            selectedCategory={selectedCategory}
            practiceMode={practiceMode}
            onPracticeModeChange={setPracticeMode}
            onCategoryClick={(category) => {
              setSelectedCategory(category);
              setLevelBreakdown([]);
              previousTotalPointsRef.current = 0;
              const minLoaderMs = 1500;
              setShowQuizLoader(true);
              quizLoaderShownAtRef.current = Date.now();
              (practiceMode
                ? getNextQuestionWithPractice(0, undefined, category)
                : getNextQuestionWithCredits(0, undefined, category)
              ).finally(() => {
                const elapsed = Date.now() - (quizLoaderShownAtRef.current ?? 0);
                const remaining = Math.max(0, minLoaderMs - elapsed);
                if (remaining > 0) {
                  setTimeout(() => {
                    setShowQuizLoader(false);
                    quizLoaderShownAtRef.current = null;
                  }, remaining);
                } else {
                  setShowQuizLoader(false);
                  quizLoaderShownAtRef.current = null;
                }
              });
            }}
          />
        </>
      );
    }

    if (step === "topup" && topUpRequired) {
      const handlePullOut = () => {
        setTopUpRequired(null);
        setPendingAfterTopUp(null);
        setError(null);
        void stopRun({ forceStopBeforeMinLevel: true });
      };
      const handleAbort = () => {
        setTopUpRequired(null);
        setPendingAfterTopUp(null);
        setError(null);
        void stopRun({ abort: true });
      };
      return (
        <div className="w-full flex-1 min-h-0 flex items-center justify-center p-4">
          <TopUpScreen
            suggestedStx={topUpRequired.suggestedAmountStx}
            recipient={topUpRequired.recipient}
            currentCreditsStx={topUpRequired.creditsStx}
            predefinedAmounts={PREDEFINED_TOP_UPS_STX}
            customAmount={topUpStepCustomStx}
            onCustomAmountChange={setTopUpStepCustomStx}
            onTopUp={(amt) => doTopUpWithWallet(amt, topUpRequired.recipient)}
            onCancel={() => { setStep("ready"); setTopUpRequired(null); setPendingAfterTopUp(null); setError(null); }}
            isToppingUp={isToppingUp}
            minTopUpStx={MIN_TOP_UP_STX}
            runId={runId}
            onPullOut={runId ? handlePullOut : undefined}
            onAbort={runId ? handleAbort : undefined}
            isEndingRun={isStoppingRun}
          />
        </div>
      );
    }

    if (step === "pay" && challenge) {
      return (
        <div className="space-y-4 max-w-md">
          <p className="text-gray-900">Pay {microStxToStx(challenge.amount)} STX to unlock. Confirm in your wallet.</p>
          <div className="flex gap-2">
            <Button onClick={payWithWallet} variant="primary" className="flex-1 py-2">Pay with wallet</Button>
            <Button onClick={cancelPay} variant="secondary" className="py-2">Cancel</Button>
          </div>
        </div>
      );
    }

    if ((step === "paying" || step === "pending") && wallet) {
      return (
        <p className="text-gray-600">
          {step === "paying" ? "Confirm payment in your wallet…" : "Transaction pending. Waiting for confirmation…"}
        </p>
      );
    }

    if (step === "question" && question) {
      return (
        <QuestionScreen
          question={question}
          level={difficulty}
          elapsedSec={elapsedSec}
          selectedIndex={selectedIndex}
          completedLevelsInRun={completedLevelsInRun}
          isSubmitting={isSubmittingAnswer}
          isStopping={isStoppingRun}
          onSelectOption={(i) => {
            selectedIndexRef.current = i;
            setSelectedIndex(i);
          }}
          onSubmit={(index) => submitAnswer(false, index)}
          onStop={() => stopRun()}
        />
      );
    }

    if (step === "submitting" && wallet) {
      return <p className="text-gray-600">Checking answer…</p>;
    }

    if (step === "correct" && result && "correct" in result && result.correct) {
      const spentSoFarStx =
        completedLevelsInRun > 0
          ? Array.from({ length: completedLevelsInRun }, (_, i) => costForLevel(i)).reduce((a, b) => a + b, 0)
          : 0;
      const profitLossSoFarStx = (result.totalPoints ?? 0) - spentSoFarStx;
      return (
        <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-center">
          <div className="space-y-6 max-w-md w-full">
            <FeedbackCorrect earnedStx={result.totalPoints} />
            <ContinueOrStopScreen
            earnedSoFarStx={result.totalPoints ?? 0}
            profitLossSoFarStx={isPracticeRun ? undefined : profitLossSoFarStx}
            nextLevel={result.level}
            completedLevels={completedLevelsInRun}
            isPractice={isPracticeRun}
            onContinue={() => isPracticeRun ? getNextQuestionWithPractice(result.level, runId) : getNextQuestionWithCredits(result.level, runId)}
            onStop={() => stopRun()}
            isContinueLoading={isGettingQuestion}
            isStopping={isStoppingRun}
          />
          </div>
        </div>
      );
    }

    if (step === "wrong" && result && "runEnded" in result) {
      const r = result as SubmitAnswerWrong & { practice?: boolean };
      const totalSpentStx = typeof r.spent === "number" ? r.spent : Number(r.spentMicroStx) / MICRO_STX_PER_STX;
      const totalEarnedStx = r.grossEarnedStx ?? (typeof r.totalPoints === "number" ? r.totalPoints : 0);
      const profitStx = r.profit ?? (totalEarnedStx - totalSpentStx);
      return (
        <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-center">
          <div className="space-y-6 max-w-md w-full">
            <FeedbackWrong
            isPractice={r.practice === true}
            timedOut={r.timedOut === true}
            levelBreakdown={levelBreakdown}
            selectedOptionText={r.selectedOptionText ?? (selectedIndex != null && question?.options?.[selectedIndex] != null ? question.options[selectedIndex] : undefined)}
            correctOptionText={r.correctOptionText}
            reasoning={r.reasoning}
            totalSpentStx={totalSpentStx}
            totalEarnedStx={totalEarnedStx}
            profitStx={profitStx}
          />
            <Button onClick={startOver} variant="primary" className="w-full py-3">Start over</Button>
          </div>
        </div>
      );
    }

    if (step === "stopped" && result && "totalPoints" in result && !("aborted" in result && result.aborted)) {
      const r = result as StopRunResponse & { practice?: boolean };
      const totalEarned = typeof r.totalPoints === "number" ? r.totalPoints : Number(r.totalPoints ?? 0);
      const spent = r.spent ?? 0;
      const profit = r.profit ?? totalEarned - spent;
      return (
        <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-center">
          <RunSummaryScreen
          correctCount={r.completedLevels ?? 0}
          totalSpentStx={spent}
          totalEarnedStx={totalEarned}
          profitStx={profit}
          isPractice={r.practice === true}
          levelBreakdown={levelBreakdown}
          onPlayAgain={startOver}
          onViewCredits={openCreditsModal}
        />
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {showQuizLoader && <QuizLoader />}
      {mainContent()}

      {showProfileModal && wallet && (
        <ProfileModal
          wallet={wallet}
          initialUser={user}
          onClose={() => setShowProfileModal(false)}
          onSaved={(updated) => {
            setUser(updated);
            setShowProfileModal(false);
            toast.success("Profile updated");
            router.push("/profile");
          }}
        />
      )}

      {showCreditsModal && (
        <Modal onClose={() => setShowCreditsModal(false)} title="Credits">
          <CreditsScreen
            balanceStx={creditsStx}
            minWithdrawStx={MIN_WITHDRAW_STX}
            withdrawAmount={withdrawAmount}
            onWithdrawAmountChange={setWithdrawAmount}
            onWithdraw={handleWithdraw}
            isWithdrawing={isWithdrawing}
            transactions={creditsHistory}
            onClose={() => setShowCreditsModal(false)}
            hideHeader
            onAddCredits={openAddCreditsFromModal}
          />
        </Modal>
      )}
    </>
  );
}
