import type { Request, Response } from "express";
import * as runStateService from "../services/run-state.service.js";
import * as runBatchService from "../services/run-batch.service.js";
import * as runService from "../services/run.service.js";
import * as creditsService from "../services/credits.service.js";
import {
  pointsToGrossEarnedStx,
  grossToNetEarnedStx,
  computeProfit,
  MIN_LEVEL_BEFORE_STOP,
} from "../config/tokenomics.js";
import { logTransaction } from "../config/logger.js";

const MICRO_STX_PER_STX = 1_000_000;

/** User stopped. Settlement: totalPoints → earned (no platform fee); profit = earned − totalSpent. */
export async function stopRun(req: Request, res: Response): Promise<void> {
  const { runId, walletAddress: wallet } = req.body as { runId?: string; walletAddress?: string };

  const walletAddress = typeof wallet === "string" ? wallet.trim() : "";
  if (!walletAddress) {
    res.status(400).json({ error: "walletAddress required" });
    return;
  }
  if (!runId || typeof runId !== "string") {
    res.status(400).json({ error: "runId required" });
    return;
  }

  const existing = runStateService.getRun(runId);
  if (!existing) {
    res.status(404).json({ error: "Run not found or expired" });
    return;
  }
  if (existing.walletAddress !== walletAddress) {
    res.status(403).json({ error: "Run does not belong to this wallet" });
    return;
  }
  if (existing.completedLevels < MIN_LEVEL_BEFORE_STOP) {
    res.status(400).json({
      error: "Must complete at least 4 levels before stopping",
      completedLevels: existing.completedLevels,
      minRequired: MIN_LEVEL_BEFORE_STOP,
    });
    return;
  }

  const run = runStateService.stopRun(runId);
  runBatchService.clearRunBatch(runId);
  if (!run) {
    res.status(404).json({ error: "Run not found or expired" });
    return;
  }
  if (run.walletAddress !== walletAddress) {
    res.status(403).json({ error: "Run does not belong to this wallet" });
    return;
  }

  const totalSpentStx = Number(run.spentMicroStx) / MICRO_STX_PER_STX;
  const grossEarnedStx = pointsToGrossEarnedStx(run.totalPoints);
  const netEarnedStx = grossToNetEarnedStx(grossEarnedStx);
  const profit = computeProfit(netEarnedStx, totalSpentStx);

  // Deferred settlement: apply full net result (earned − spent) to credits in one shot.
  const netResultMicroStx = Math.round(profit * MICRO_STX_PER_STX);
  await runService.addProfitToCredits(walletAddress, netResultMicroStx);
  const balance = await creditsService.getBalance(walletAddress);
  await creditsService.recordTransaction(
    walletAddress,
    "profit",
    netResultMicroStx,
    balance.creditsMicroStx,
    { refRunId: runId }
  );
  logTransaction("profit", walletAddress, profit, balance.creditsStx, { runId });

  const { bonusStx: milestoneBonusStx, milestoneTier } = await runService.computeAndAddMilestoneBonus(
    walletAddress,
    run.completedLevels,
    runId
  );
  if (milestoneBonusStx > 0) {
    const balanceAfter = await creditsService.getBalance(walletAddress);
    logTransaction("milestone_bonus", walletAddress, milestoneBonusStx, balanceAfter.creditsStx, { runId });
  }

  try {
    const result = await runService.endRun(walletAddress, {
      questionIds: run.questionIds ?? [],
      questionResults: run.questionResults ?? [],
      deliveredQuestionInfo: run.deliveredQuestionInfo ?? [],
      score: run.totalPoints,
      spent: totalSpentStx,
      earned: netEarnedStx,
    });
    const balance = await creditsService.getBalance(walletAddress);
    res.status(201).json({
      runId: result.runId,
      totalPoints: run.totalPoints,
      completedLevels: run.completedLevels,
      spent: totalSpentStx,
      grossEarnedStx,
      netEarnedStx,
      profit,
      milestoneBonusStx,
      milestoneTier: milestoneTier ?? null,
      creditsStx: balance.creditsStx,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "User not found") {
      res.status(404).json({ error: "User not found" });
      return;
    }
    throw err;
  }
}
