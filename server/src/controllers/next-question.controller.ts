import type { Request, Response } from "express";
import * as challengeService from "../services/challenge.service.js";
import * as stacksService from "../services/stacks.service.js";
import * as userService from "../services/user.service.js";
import { getCategoryPlayCount, incrementCategoryPlayCount, getMaxCategoryPlaysBeta } from "../services/user.service.js";
import * as questionService from "../services/question.service.js";
import * as runStateService from "../services/run-state.service.js";
import * as runBatchService from "../services/run-batch.service.js";
import * as creditsService from "../services/credits.service.js";
import {
  getCostMicroStx,
  getTotalCostMicroStxThroughLevel,
  getDifficultyLabel,
  TOP_UP_SUGGESTED_STX,
  QUESTION_TIME_CAP_SEC,
  MIN_LEVEL_BEFORE_STOP,
} from "../config/tokenomics.js";
import { STACKS_RECIPIENT_ADDRESS } from "../config/stacks.js";
import { logger } from "../config/logger.js";

/** GET: issue 402 with cost for given difficulty. Client sends ?difficulty=0 for first question. */
export async function getNextQuestion(req: Request, res: Response): Promise<void> {
  const difficulty = Math.max(0, Math.min(9, Number(req.query.difficulty) || 0));
  try {
    const challenge = await challengeService.issueChallenge(difficulty);
    res.status(402).json(challenge);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    res.status(503).json({
      error:
        err instanceof Error ? err.message : "Server misconfiguration: payment recipient not set",
    });
  }
}

export async function submitPaymentAndGetQuestion(
  req: Request,
  res: Response
): Promise<void> {
  const raw = req.body as {
    txId?: string;
    nonce?: string;
    runId?: string;
    difficulty?: number;
    useCredits?: boolean;
    practice?: boolean;
    walletAddress?: string;
    preferredCategory?: string;
  };
  const txId = typeof raw.txId === "string" ? raw.txId.trim() : "";
  const nonce = typeof raw.nonce === "string" ? raw.nonce.trim() : "";
  const runId = typeof raw.runId === "string" ? raw.runId.trim() || undefined : undefined;
  const useCredits = raw.useCredits === true;
  const practice = raw.practice === true;
  const walletAddressBody = typeof raw.walletAddress === "string" ? raw.walletAddress.trim() : "";
  const preferredCategory = typeof raw.preferredCategory === "string" ? raw.preferredCategory.trim() || undefined : undefined;

  logger.info(`POST /next-question txId=${txId ? `${txId.slice(0, 8)}...` : ""} nonceLen=${nonce.length} runId=${runId ?? "none"} useCredits=${useCredits} practice=${practice}`);

  // Practice mode: no tokenomics — no payment, no credits, no settlement. Same gameplay, zero cost.
  if (practice && walletAddressBody) {
    let level: number;
    if (runId) {
      const run = runStateService.getRun(runId);
      if (!run) {
        res.status(400).json({ error: "Run not found or expired" });
        return;
      }
      if (run.walletAddress !== walletAddressBody) {
        res.status(403).json({ error: "Run does not belong to this wallet" });
        return;
      }
      if (!run.isPractice) {
        res.status(400).json({ error: "This run is a paid run; use practice runId only with practice: true" });
        return;
      }
      level = run.level;
    } else {
      level = Math.max(0, Math.min(9, Number(raw.difficulty) ?? 0));
    }
    const user = await userService.findOrCreateUser(walletAddressBody);
    let resolvedRunId: string;
    const seed = `practice-${level}-${walletAddressBody}-${Date.now()}`;
    try {
      const result = await questionService.getQuestionForRun(runId, level, user._id, seed, preferredCategory, true);
      const { payload, questionId, category: resultCategory, restBatch } = result;
      const estimatedSolveTimeSec = QUESTION_TIME_CAP_SEC;
      const costMicroStx = 0n;
      if (runId) {
        const updated = runStateService.setQuestionForRun(
          runId,
          level,
          payload.correct_index,
          costMicroStx,
          estimatedSolveTimeSec
        );
        if (!updated) {
          res.status(400).json({ error: "Run not found or expired" });
          return;
        }
        runStateService.addQuestionIdToRun(runId, questionId);
        runStateService.addDeliveredQuestionInfo(runId, questionId, payload.correct_index, payload.options, payload.reasoning);
        resolvedRunId = runId;
      } else {
        const category = resultCategory ?? runBatchService.pickCategoryForNewRun();
        resolvedRunId = runStateService.createRun(
          walletAddressBody,
          level,
          payload.correct_index,
          costMicroStx,
          estimatedSolveTimeSec,
          category,
          true
        );
        runStateService.addQuestionIdToRun(resolvedRunId, questionId);
        runStateService.addDeliveredQuestionInfo(resolvedRunId, questionId, payload.correct_index, payload.options, payload.reasoning);
        if (restBatch && restBatch.length > 0) {
          await runBatchService.setBatch(resolvedRunId, category, restBatch);
        }
      }
      const json: Record<string, unknown> = {
        question: payload.question,
        options: payload.options,
        difficulty: payload.difficulty,
        difficultyLabel: getDifficultyLabel(level),
        estimated_solve_time_sec: QUESTION_TIME_CAP_SEC,
        runId: resolvedRunId,
        level,
        practice: true,
      };
      if (process.env.NODE_ENV === "development") {
        json.correctIndex = payload.correct_index;
      }
      res.json(json);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(errMsg);
      res.status(502).json({ error: "Question generation failed" });
    }
    return;
  }

  // Credits path: deferred settlement — no deduction until run end. Check balance covers full run cost so far + this question.
  if (useCredits && walletAddressBody) {
    let level: number;
    let totalRequiredMicroStx: number;
    if (runId) {
      const run = runStateService.getRun(runId);
      if (!run) {
        res.status(400).json({ error: "Run not found or expired" });
        return;
      }
      if (run.walletAddress !== walletAddressBody) {
        res.status(403).json({ error: "Run does not belong to this wallet" });
        return;
      }
      if (run.isPractice) {
        res.status(400).json({ error: "This run is a practice run; use credits with a paid run" });
        return;
      }
      level = run.level;
      const costMicroStx = getCostMicroStx(level);
      totalRequiredMicroStx = Number(run.spentMicroStx) + Number(costMicroStx);
    } else {
      // Beta: each category can be played at most getMaxCategoryPlaysBeta() times (e.g. 2).
      const categoryToCheck = preferredCategory?.trim() || undefined;
      if (categoryToCheck) {
        const count = await getCategoryPlayCount(walletAddressBody, categoryToCheck);
        if (count >= getMaxCategoryPlaysBeta()) {
          res.status(400).json({
            error: "This category has reached its play limit for the current beta. Try another category.",
            betaLimit: true,
          });
          return;
        }
      }
      level = Math.max(0, Math.min(9, Number(raw.difficulty) ?? 0));
      // Pre-start: require balance to cover levels 0 through 9 so the game can be played without mid-run top-up.
      const requiredToStartMicroStx = getTotalCostMicroStxThroughLevel(9);
      totalRequiredMicroStx = Number(requiredToStartMicroStx);
    }
    const balanceMicroStx = await userService.getCreditsMicroStx(walletAddressBody);
    if (balanceMicroStx < totalRequiredMicroStx) {
      const payload: Record<string, unknown> = {
        error: "Insufficient credits",
        topUp: true,
        suggestedAmountStx: TOP_UP_SUGGESTED_STX,
        recipient: (STACKS_RECIPIENT_ADDRESS || "").trim(),
        creditsStx: balanceMicroStx / 1_000_000,
        requiredStx: totalRequiredMicroStx / 1_000_000,
      };
      // Mid-run insufficient: always offer two options — (1) top up to continue, (2) pull out without adding funds. If user opts not to add funds: level < 4 → settle (force stop); level >= 4 → cash out. Never lose history.
      if (runId) {
        const run = runStateService.getRun(runId);
        const completedLevels = run?.completedLevels ?? 0;
        payload.insufficientMidRun = true;
        payload.completedLevels = completedLevels;
        payload.canPullOut = true; // User may choose to pull out (don't top up) in both cases
        if (completedLevels < MIN_LEVEL_BEFORE_STOP) {
          payload.mustSettle = true; // If they pull out: must call stop with forceStopBeforeMinLevel to settle and save history
          payload.message =
            "Insufficient credits. Option 1: Top up to continue. Option 2: Pull out (don't add funds) — call POST /run/stop with forceStopBeforeMinLevel: true to settle and save run history.";
        } else {
          payload.message =
            "Insufficient credits. Option 1: Top up to continue. Option 2: Pull out (don't add funds) — call POST /run/stop to cash out and save run history.";
        }
      } else {
        payload.requiredForLevels0To9 = true;
        payload.message = "Need enough credits for levels 0–9 to start a run. Top up first.";
      }
      res.status(402).json(payload);
      return;
    }
    const costMicroStx = getCostMicroStx(level);
    const user = await userService.findOrCreateUser(walletAddressBody);
    let resolvedRunId: string;
    const seed = `credits-${level}-${walletAddressBody}-${Date.now()}`;
    try {
      const result = await questionService.getQuestionForRun(runId, level, user._id, seed, preferredCategory, false);
      const { payload, questionId, category: resultCategory, restBatch } = result;
      logger.info("[next-question] delivering question (credits)", {
        runId: runId?.slice(0, 8),
        level,
        correct_index: payload.correct_index,
        correct_indexType: typeof payload.correct_index,
        options: payload.options,
        questionPreview: payload.question?.slice(0, 60),
      });
      const estimatedSolveTimeSec = QUESTION_TIME_CAP_SEC;
      if (runId) {
        const updated = runStateService.setQuestionForRun(
          runId,
          level,
          payload.correct_index,
          costMicroStx,
          estimatedSolveTimeSec
        );
        if (!updated) {
          res.status(400).json({ error: "Run not found or expired" });
          return;
        }
        runStateService.addQuestionIdToRun(runId, questionId);
        runStateService.addDeliveredQuestionInfo(runId, questionId, payload.correct_index, payload.options, payload.reasoning);
        resolvedRunId = runId;
      } else {
        const category = resultCategory ?? runBatchService.pickCategoryForNewRun();
        resolvedRunId = runStateService.createRun(
          walletAddressBody,
          level,
          payload.correct_index,
          costMicroStx,
          estimatedSolveTimeSec,
          category
        );
        if (category) await incrementCategoryPlayCount(walletAddressBody, category);
        runStateService.addQuestionIdToRun(resolvedRunId, questionId);
        runStateService.addDeliveredQuestionInfo(resolvedRunId, questionId, payload.correct_index, payload.options, payload.reasoning);
        if (restBatch && restBatch.length > 0) {
          await runBatchService.setBatch(resolvedRunId, category, restBatch);
        }
      }
      const json: Record<string, unknown> = {
        question: payload.question,
        options: payload.options,
        difficulty: payload.difficulty,
        difficultyLabel: getDifficultyLabel(level),
        estimated_solve_time_sec: QUESTION_TIME_CAP_SEC,
        runId: resolvedRunId,
        level,
      };
      if (process.env.NODE_ENV === "development") {
        json.correctIndex = payload.correct_index;
      }
      res.json(json);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(errMsg);
      const isRateLimit =
        typeof errMsg === "string" &&
        (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("rate limit"));
      res.status(502).json({
        error: isRateLimit
          ? "AI rate limit reached. Try again in a few minutes."
          : "Question generation failed",
      });
    }
    return;
  }

  if (!txId || !nonce) {
    res.status(400).json({ error: "txId and nonce required" });
    return;
  }

  const challengeStatus = await challengeService.getChallengeStatus(nonce);
  if (challengeStatus !== "valid") {
    logger.warn(`Challenge invalid status=${challengeStatus} nonceTail=${nonce.length >= 8 ? nonce.slice(-8) : nonce}`);
    const message =
      challengeStatus === "not_found"
        ? "Challenge not found. Get a new one (click Get first question again)."
        : challengeStatus === "used"
          ? "Challenge already used. Get a new challenge for the next question."
          : "Challenge expired. Get a new one (click Get first question again).";
    res.status(402).json({ error: message });
    return;
  }

  const entry = await challengeService.getChallenge(nonce);
  if (!entry) {
    res.status(402).json({ error: "Challenge not found" });
    return;
  }

  // Resolve difficulty and verify payment amount matches tokenomics cost for this level
  let difficulty: number;
  if (runId) {
    const run = runStateService.getRun(runId);
    if (!run) {
      res.status(400).json({ error: "Run not found or expired" });
      return;
    }
    difficulty = run.level;
    const expectedMicroStx = getCostMicroStx(difficulty);
    if (entry.priceMicroStx !== expectedMicroStx) {
      res.status(402).json({ error: "Payment amount does not match cost for this level" });
      return;
    }
  } else {
    difficulty = Math.max(0, Math.min(9, Number(raw.difficulty) ?? 0));
    const expectedMicroStx = getCostMicroStx(difficulty);
    if (entry.priceMicroStx !== expectedMicroStx) {
      res.status(402).json({ error: "Payment amount does not match cost for this level" });
      return;
    }
  }

  const verification = await stacksService.verifyPayment(txId, {
    recipientAddress: entry.recipient,
    amountMicroStx: entry.priceMicroStx,
    nonce,
  });

  if (!verification.ok) {
    res.status(402).json({ error: verification.reason });
    return;
  }

  await challengeService.consumeChallenge(nonce);
  const user = await userService.findOrCreateUser(verification.senderAddress);
  const walletAddress = verification.senderAddress;

  let level: number;
  let resolvedRunId: string;

  if (runId) {
    const run = runStateService.getRun(runId);
    if (!run) {
      res.status(400).json({ error: "Run not found or expired" });
      return;
    }
    if (run.walletAddress !== walletAddress) {
      res.status(403).json({ error: "Run does not belong to this wallet" });
      return;
    }
    level = run.level;
    resolvedRunId = runId;
  } else {
    level = difficulty; // 0 for first question
    resolvedRunId = "";
  }

  if (!resolvedRunId && preferredCategory) {
    const count = await getCategoryPlayCount(walletAddress, preferredCategory);
    if (count >= getMaxCategoryPlaysBeta()) {
      res.status(400).json({
        error: "This category has reached its play limit for the current beta. Try another category.",
        betaLimit: true,
      });
      return;
    }
  }

  try {
    const result = await questionService.getQuestionForRun(
      resolvedRunId || undefined,
      level,
      user._id,
      `level-${level}-${nonce}`,
      preferredCategory,
      false
    );
    const { payload, questionId, category: resultCategory, restBatch } = result;
    const priceMicroStx = entry.priceMicroStx;
    const estimatedSolveTimeSec = QUESTION_TIME_CAP_SEC;

    if (resolvedRunId) {
      const updated = runStateService.setQuestionForRun(
        resolvedRunId,
        level,
        payload.correct_index,
        priceMicroStx,
        estimatedSolveTimeSec
      );
      if (!updated) {
        res.status(400).json({ error: "Run not found or expired" });
        return;
      }
      runStateService.addQuestionIdToRun(resolvedRunId, questionId);
      runStateService.addDeliveredQuestionInfo(resolvedRunId, questionId, payload.correct_index, payload.options, payload.reasoning);
    } else {
      const category = resultCategory ?? runBatchService.pickCategoryForNewRun();
      resolvedRunId = runStateService.createRun(
        walletAddress,
        level,
        payload.correct_index,
        priceMicroStx,
        estimatedSolveTimeSec,
        category
      );
      if (category) await incrementCategoryPlayCount(walletAddress, category);
      runStateService.addQuestionIdToRun(resolvedRunId, questionId);
      runStateService.addDeliveredQuestionInfo(resolvedRunId, questionId, payload.correct_index, payload.options, payload.reasoning);
      if (restBatch && restBatch.length > 0) {
        await runBatchService.setBatch(resolvedRunId, category, restBatch);
      }
    }

    const json: Record<string, unknown> = {
      question: payload.question,
      options: payload.options,
      difficulty: payload.difficulty,
      difficultyLabel: getDifficultyLabel(level),
      estimated_solve_time_sec: QUESTION_TIME_CAP_SEC,
      runId: resolvedRunId,
      level,
    };
    if (process.env.NODE_ENV === "development") {
      json.correctIndex = payload.correct_index;
    }
    res.json(json);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    res.status(502).json({
      error: "Question generation failed after retries; payment may be refunded",
    });
  }
}
