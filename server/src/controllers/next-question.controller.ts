import type { Request, Response } from "express";
import * as challengeService from "../services/challenge.service.js";
import * as stacksService from "../services/stacks.service.js";
import * as userService from "../services/user.service.js";
import * as questionService from "../services/question.service.js";
import { logger } from "../config/logger.js";

export function getNextQuestion(_req: Request, res: Response): void {
  const challenge = challengeService.issueChallenge();
  res.status(402).json(challenge);
}

export async function submitPaymentAndGetQuestion(
  req: Request,
  res: Response
): Promise<void> {
  const { txId, nonce, level = 1, topicPool = "general" } = req.body as {
    txId?: string;
    nonce?: string;
    level?: number;
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

  try {
    const question = await questionService.generateQuestion(
      {
        level: Number(level) || 1,
        topicPool: String(topicPool),
        difficultyScalar: 0.5 + (Number(level) || 1) * 0.1,
        timeLimitSec: 120,
        seed: `level-${level}-${nonce}`,
      },
      {
        txId,
        nonce,
        userId: user._id,
      }
    );
    res.json(question);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    res.status(502).json({
      error: "Question generation failed after retries; payment may be refunded",
    });
  }
}
