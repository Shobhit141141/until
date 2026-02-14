import type { Request, Response } from "express";
import * as runStateService from "../services/run-state.service.js";
import * as runService from "../services/run.service.js";
import * as benchmarkService from "../services/benchmark.service.js";

const MICRO_STX_PER_STX = 1_000_000;

/** Submit answer. Server-only verification. Never trust client for correctness. */
export async function submitAnswer(req: Request, res: Response): Promise<void> {
  const { runId, selectedIndex } = req.body as { runId?: string; selectedIndex?: number };

  if (!runId || typeof runId !== "string") {
    res.status(400).json({ error: "runId required" });
    return;
  }
  const idx = Number(selectedIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx > 3) {
    res.status(400).json({ error: "selectedIndex must be 0-3" });
    return;
  }

  const result = runStateService.submitAnswer(runId, idx);

  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }

  if (result.correct) {
    res.json({
      correct: true,
      level: result.level,
      completedLevels: result.completedLevels,
    });
    return;
  }

  // Wrong answer: run ended. Persist run (locked rewards = user keeps).
  const score = result.completedLevels;
  const spentStx = Number(result.spentMicroStx) / MICRO_STX_PER_STX;
  const benchmark = benchmarkService.getBenchmark(score);
  const earnedStx = benchmarkService.computeEarnedStx(score, benchmark);

  try {
    const endResult = await runService.endRun(result.walletAddress, {
      questionIds: [],
      score,
      spent: spentStx,
      earned: earnedStx,
    });
    res.json({
      correct: false,
      runEnded: true,
      completedLevels: score,
      spentMicroStx: result.spentMicroStx.toString(),
      runId: endResult.runId,
      earned: earnedStx,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "User not found") {
      res.status(404).json({ error: "User not found" });
      return;
    }
    throw err;
  }
}
