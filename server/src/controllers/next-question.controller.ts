import type { Request, Response } from "express";
import * as challengeService from "../services/challenge.service.js";
import * as stacksService from "../services/stacks.service.js";
import * as userService from "../services/user.service.js";
import * as questionService from "../services/question.service.js";
import * as runStateService from "../services/run-state.service.js";
import * as runBatchService from "../services/run-batch.service.js";
import * as creditsService from "../services/credits.service.js";
import { getCostMicroStx, getDifficultyLabel, TOP_UP_SUGGESTED_STX } from "../config/tokenomics.js";
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
      const result = await questionService.getQuestionForRun(runId, level, user._id, seed, preferredCategory);
      const { payload, questionId, category: resultCategory, restBatch } = result;
      const estimatedSolveTimeSec = payload.estimated_solve_time_sec ?? 30;
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
          runBatchService.setBatch(resolvedRunId, category, restBatch);
        }
      }
      const json: Record<string, unknown> = {
        question: payload.question,
        options: payload.options,
        difficulty: payload.difficulty,
        difficultyLabel: getDifficultyLabel(level),
        estimated_solve_time_sec: payload.estimated_solve_time_sec,
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
      level = Math.max(0, Math.min(9, Number(raw.difficulty) ?? 0));
      const costMicroStx = getCostMicroStx(level);
      totalRequiredMicroStx = Number(costMicroStx);
    }
    const balanceMicroStx = await userService.getCreditsMicroStx(walletAddressBody);
    if (balanceMicroStx < totalRequiredMicroStx) {
      res.status(402).json({
        error: "Insufficient credits",
        topUp: true,
        suggestedAmountStx: TOP_UP_SUGGESTED_STX,
        recipient: (STACKS_RECIPIENT_ADDRESS || "").trim(),
        creditsStx: balanceMicroStx / 1_000_000,
        requiredStx: totalRequiredMicroStx / 1_000_000,
      });
      return;
    }
    const costMicroStx = getCostMicroStx(level);
    const user = await userService.findOrCreateUser(walletAddressBody);
    let resolvedRunId: string;
    const seed = `credits-${level}-${walletAddressBody}-${Date.now()}`;
    try {
      const result = await questionService.getQuestionForRun(runId, level, user._id, seed, preferredCategory);
      const { payload, questionId, category: resultCategory, restBatch } = result;
      const estimatedSolveTimeSec = payload.estimated_solve_time_sec ?? 30;
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
        runStateService.addQuestionIdToRun(resolvedRunId, questionId);
        runStateService.addDeliveredQuestionInfo(resolvedRunId, questionId, payload.correct_index, payload.options, payload.reasoning);
        if (restBatch && restBatch.length > 0) {
          runBatchService.setBatch(resolvedRunId, category, restBatch);
        }
      }
      const json: Record<string, unknown> = {
        question: payload.question,
        options: payload.options,
        difficulty: payload.difficulty,
        difficultyLabel: getDifficultyLabel(level),
        estimated_solve_time_sec: payload.estimated_solve_time_sec,
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

  try {
    const result = await questionService.getQuestionForRun(
      resolvedRunId || undefined,
      level,
      user._id,
      `level-${level}-${nonce}`,
      preferredCategory
    );
    const { payload, questionId, category: resultCategory, restBatch } = result;
    const priceMicroStx = entry.priceMicroStx;
    const estimatedSolveTimeSec = payload.estimated_solve_time_sec ?? 30;

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
      runStateService.addQuestionIdToRun(resolvedRunId, questionId);
      runStateService.addDeliveredQuestionInfo(resolvedRunId, questionId, payload.correct_index, payload.options, payload.reasoning);
      if (restBatch && restBatch.length > 0) {
        runBatchService.setBatch(resolvedRunId, category, restBatch);
      }
    }

    const json: Record<string, unknown> = {
      question: payload.question,
      options: payload.options,
      difficulty: payload.difficulty,
      difficultyLabel: getDifficultyLabel(level),
      estimated_solve_time_sec: payload.estimated_solve_time_sec,
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
