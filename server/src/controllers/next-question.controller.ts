import type { Request, Response } from "express";
import * as challengeService from "../services/challenge.service.js";
import * as stacksService from "../services/stacks.service.js";
import * as userService from "../services/user.service.js";
import * as questionService from "../services/question.service.js";
import * as runStateService from "../services/run-state.service.js";
import { getCostMicroStx, getDifficultyLabel } from "../config/tokenomics.js";
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
    topicPool?: string;
    difficulty?: number;
  };
  const txId = typeof raw.txId === "string" ? raw.txId.trim() : "";
  const nonce = typeof raw.nonce === "string" ? raw.nonce.trim() : "";
  const runId = typeof raw.runId === "string" ? raw.runId.trim() || undefined : undefined;
  const topicPool = typeof raw.topicPool === "string" ? raw.topicPool : "general";

  logger.info(`POST /next-question txId=${txId ? `${txId.slice(0, 8)}...` : ""} nonceLen=${nonce.length} runId=${runId ?? "none"}`);

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
    const payload = await questionService.generateQuestion(
      {
        level,
        topicPool: String(topicPool),
        difficultyScalar: 0.5 + level * 0.1,
        timeLimitSec: 120,
        seed: `level-${level}-${nonce}`,
      },
      {
        txId,
        nonce,
        userId: user._id,
      }
    );

    const priceMicroStx = entry.priceMicroStx;

    const estimatedSolveTimeSec = payload.estimated_solve_time_sec ?? 60;

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
    } else {
      resolvedRunId = runStateService.createRun(
        walletAddress,
        level,
        payload.correct_index,
        priceMicroStx,
        estimatedSolveTimeSec
      );
    }

    // Never send correct_index to client
    res.json({
      question: payload.question,
      options: payload.options,
      difficulty: payload.difficulty,
      difficultyLabel: getDifficultyLabel(level),
      estimated_solve_time_sec: payload.estimated_solve_time_sec,
      runId: resolvedRunId,
      level,
    });
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    res.status(502).json({
      error: "Question generation failed after retries; payment may be refunded",
    });
  }
}
