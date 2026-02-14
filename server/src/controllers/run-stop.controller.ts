import type { Request, Response } from "express";
import * as runStateService from "../services/run-state.service.js";
import * as runService from "../services/run.service.js";
import {
  pointsToGrossEarnedStx,
  grossToNetEarnedStx,
  computeProfit,
} from "../config/tokenomics.js";

const MICRO_STX_PER_STX = 1_000_000;

/** User stopped. Settlement: totalPoints → gross → net; profit = netEarned − totalSpent. */
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

  const run = runStateService.stopRun(runId);
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

  try {
    const result = await runService.endRun(walletAddress, {
      questionIds: [],
      score: run.totalPoints,
      spent: totalSpentStx,
      earned: netEarnedStx,
    });
    res.status(201).json({
      runId: result.runId,
      totalPoints: run.totalPoints,
      completedLevels: run.completedLevels,
      spent: totalSpentStx,
      grossEarnedStx,
      netEarnedStx,
      profit,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "User not found") {
      res.status(404).json({ error: "User not found" });
      return;
    }
    throw err;
  }
}
