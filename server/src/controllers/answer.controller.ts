import type { Request, Response } from "express";
import * as runStateService from "../services/run-state.service.js";
import * as runBatchService from "../services/run-batch.service.js";
import * as runService from "../services/run.service.js";
import {
  pointsToGrossEarnedStx,
  grossToNetEarnedStx,
  computeProfit,
} from "../config/tokenomics.js";
import { logger, logTransaction } from "../config/logger.js";
import * as creditsService from "../services/credits.service.js";
import { isValidStacksAddress } from "../config/stacks.js";

const MICRO_STX_PER_STX = 1_000_000;

/** Submit answer. Server-only verification. Score = basePoints × timeMultiplier; settlement from totalPoints. */
export async function submitAnswer(req: Request, res: Response): Promise<void> {
  const { runId, selectedIndex, walletAddress: wallet, timedOut: clientTimedOut } = req.body as {
    runId?: string;
    selectedIndex?: number;
    walletAddress?: string;
    timedOut?: boolean;
  };
  const walletAddress = typeof wallet === "string" ? wallet.trim() : "";
  const idx = Number(selectedIndex);
  const isTimeoutSubmission = clientTimedOut === true && (selectedIndex === -1 || selectedIndex === undefined);
  logger.info("[answer] submit body", {
    runId: runId?.slice?.(0, 8),
    selectedIndexRaw: selectedIndex,
    selectedIndexType: typeof selectedIndex,
    selectedIndexNormalized: idx,
    isInteger: Number.isInteger(idx),
    clientTimedOut: !!clientTimedOut,
  });

  if (!runId || typeof runId !== "string") {
    res.status(400).json({ error: "runId required" });
    return;
  }
  if (!walletAddress) {
    res.status(400).json({ error: "walletAddress required" });
    return;
  }
  if (!isValidStacksAddress(walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }
  const validIndex = Number.isInteger(idx) && idx >= 0 && idx <= 3;
  const validTimeoutIndex = isTimeoutSubmission && idx === -1;
  if (!validIndex && !validTimeoutIndex) {
    res.status(400).json({ error: "selectedIndex must be 0-3, or -1 with timedOut for timeout" });
    return;
  }
  const indexToSubmit = validTimeoutIndex ? -1 : idx;

  const run = runStateService.getRun(runId);
  if (!run) {
    res.status(404).json({ error: "Run not found or expired" });
    return;
  }
  if (run.walletAddress !== walletAddress) {
    res.status(403).json({ error: "Run does not belong to this wallet" });
    return;
  }

  const result = runStateService.submitAnswer(runId, indexToSubmit);

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

  // Wrong answer: run ended. Clear run batch.
  await runBatchService.clearRunBatch(runId);

  // Practice run: no settlement, no credits, no GameRun persist.
  if (result.isPractice) {
    res.json({
      correct: false,
      runEnded: true,
      timedOut: result.timedOut,
      completedLevels: result.completedLevels,
      totalPoints: result.totalPoints,
      spent: 0,
      spentMicroStx: "0",
      runId,
      grossEarnedStx: 0,
      netEarnedStx: 0,
      profit: 0,
      milestoneBonusStx: 0,
      milestoneTier: null,
      selectedOptionText: result.selectedOptionText,
      correctOptionText: result.correctOptionText,
      reasoning: result.reasoning,
      practice: true,
    });
    return;
  }

  // Deferred settlement: apply full net result (earned − spent) to credits in one shot.
  const totalSpentStx = Number(result.spentMicroStx) / MICRO_STX_PER_STX;
  const grossEarnedStx = pointsToGrossEarnedStx(result.totalPoints);
  const netEarnedStx = grossToNetEarnedStx(grossEarnedStx);
  const profit = computeProfit(netEarnedStx, totalSpentStx);
  const netResultMicroStx = Math.round(profit * MICRO_STX_PER_STX);
  await runService.addProfitToCredits(result.walletAddress, netResultMicroStx);
  const balanceAfterProfit = await creditsService.getBalance(result.walletAddress);
  const txType = netResultMicroStx >= 0 ? "profit" : "loss";
  await creditsService.recordTransaction(
    result.walletAddress,
    txType,
    netResultMicroStx,
    balanceAfterProfit.creditsMicroStx,
    { refRunId: runId }
  );
  logTransaction(`${txType} (wrong)`, result.walletAddress, profit, balanceAfterProfit.creditsStx, { runId });

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
    if (milestoneBonusStx > 0) {
      const balanceAfter = await creditsService.getBalance(result.walletAddress);
      logTransaction("milestone_bonus", result.walletAddress, milestoneBonusStx, balanceAfter.creditsStx, { runId: endResult.runId });
    }
    const finalBalance = await creditsService.getBalance(result.walletAddress);
    res.json({
      correct: false,
      runEnded: true,
      timedOut: result.timedOut,
      completedLevels: result.completedLevels,
      totalPoints: result.totalPoints,
      spent: totalSpentStx,
      spentMicroStx: result.spentMicroStx.toString(),
      runId: endResult.runId,
      grossEarnedStx,
      netEarnedStx,
      profit,
      milestoneBonusStx,
      milestoneTier: milestoneTier ?? null,
      creditsStx: finalBalance.creditsStx,
      selectedOptionText: "selectedOptionText" in result ? result.selectedOptionText : undefined,
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
