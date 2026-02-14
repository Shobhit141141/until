import type { Request, Response } from "express";
import * as runStateService from "../services/run-state.service.js";
import * as runService from "../services/run.service.js";
import * as benchmarkService from "../services/benchmark.service.js";

const MICRO_STX_PER_STX = 1_000_000;

/** User stopped. Server computes score from run state and evaluates benchmark. */
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

  const score = run.completedLevels;
  const spentStx = Number(run.spentMicroStx) / MICRO_STX_PER_STX;
  const benchmark = benchmarkService.getBenchmark(score);
  const earnedStx = benchmarkService.computeEarnedStx(score, benchmark);

  try {
    const result = await runService.endRun(walletAddress, {
      questionIds: [],
      score,
      spent: spentStx,
      earned: earnedStx,
    });
    res.status(201).json({
      runId: result.runId,
      score,
      spent: spentStx,
      earned: earnedStx,
      benchmark,
      payout: earnedStx > 0,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "User not found") {
      res.status(404).json({ error: "User not found" });
      return;
    }
    throw err;
  }
}
