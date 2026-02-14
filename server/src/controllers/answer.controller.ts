import type { Request, Response } from "express";
import * as runStateService from "../services/run-state.service.js";
import * as runBatchService from "../services/run-batch.service.js";
import * as runService from "../services/run.service.js";
import {
  pointsToGrossEarnedStx,
  grossToNetEarnedStx,
  computeProfit,
} from "../config/tokenomics.js";

const MICRO_STX_PER_STX = 1_000_000;

/** Submit answer. Server-only verification. Score = basePoints × timeMultiplier; settlement from totalPoints. */
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
      totalPoints: result.totalPoints,
    });
    return;
  }

  // Wrong answer: run ended. Clear run batch and settle.
  runBatchService.clearRunBatch(runId);
  const totalSpentStx = Number(result.spentMicroStx) / MICRO_STX_PER_STX;
  const grossEarnedStx = pointsToGrossEarnedStx(result.totalPoints);
  const netEarnedStx = grossToNetEarnedStx(grossEarnedStx);
  const profit = computeProfit(netEarnedStx, totalSpentStx);
  const profitMicroStx = Math.round(profit * MICRO_STX_PER_STX);
  await runService.addProfitToCredits(result.walletAddress, profitMicroStx);

  try {
    const questionIds = "questionIds" in result ? result.questionIds : [];
    const questionResults = "questionResults" in result ? result.questionResults : [];
    const deliveredQuestionInfo = "deliveredQuestionInfo" in result ? result.deliveredQuestionInfo : [];
    const endResult = await runService.endRun(result.walletAddress, {
      questionIds,
      questionResults,
      deliveredQuestionInfo,
      score: result.totalPoints,
      spent: totalSpentStx,
      earned: netEarnedStx,
    });
    const { bonusStx: milestoneBonusStx, milestoneTier } = await runService.computeAndAddMilestoneBonus(
      result.walletAddress,
      result.completedLevels,
      endResult.runId
    );
    res.json({
      correct: false,
      runEnded: true,
      completedLevels: result.completedLevels,
      totalPoints: result.totalPoints,
      spentMicroStx: result.spentMicroStx.toString(),
      runId: endResult.runId,
      grossEarnedStx,
      netEarnedStx,
      profit,
      milestoneBonusStx,
      milestoneTier: milestoneTier ?? null,
      correctOptionText: "correctOptionText" in result ? result.correctOptionText : undefined,
      reasoning: "reasoning" in result ? result.reasoning : undefined,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "User not found") {
      res.status(404).json({ error: "User not found" });
      return;
    }
    throw err;
  }
}
