import type { Request, Response } from "express";
import * as challengeService from "../services/challenge.service.js";
import * as stacksService from "../services/stacks.service.js";
import * as userService from "../services/user.service.js";
import * as questionService from "../services/question.service.js";
import * as runStateService from "../services/run-state.service.js";
import { logger } from "../config/logger.js";

export function getNextQuestion(_req: Request, res: Response): void {
  const challenge = challengeService.issueChallenge();
  res.status(402).json(challenge);
}

export async function submitPaymentAndGetQuestion(
  req: Request,
  res: Response
): Promise<void> {
  const { txId, nonce, runId, topicPool = "general" } = req.body as {
    txId?: string;
    nonce?: string;
    runId?: string;
    topicPool?: string;
  };

  if (!txId || !nonce) {
    res.status(400).json({ error: "txId and nonce required" });
    return;
  }

  if (!challengeService.isChallengeValid(nonce)) {
    res.status(402).json({ error: "Invalid or expired challenge" });
    return;
  }

  const entry = challengeService.getChallenge(nonce);
  if (!entry) {
    res.status(402).json({ error: "Challenge not found" });
    return;
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

  challengeService.consumeChallenge(nonce);
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
    level = 1;
    resolvedRunId = ""; // set after we have correctIndex
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

    if (resolvedRunId) {
      const updated = runStateService.setQuestionForRun(
        resolvedRunId,
        level,
        payload.correct_index,
        priceMicroStx
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
        priceMicroStx
      );
    }

    // Never send correct_index to client
    res.json({
      question: payload.question,
      options: payload.options,
      difficulty: payload.difficulty,
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
