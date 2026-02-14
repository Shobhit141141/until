import mongoose from "mongoose";
import { User } from "../models/User.js";
import { GameRun } from "../models/GameRun.js";
import { Question } from "../models/Question.js";
import * as userService from "./user.service.js";
import * as creditsService from "./credits.service.js";
import { computeMilestoneBonus, MAX_QUESTIONS } from "../config/tokenomics.js";

export type EndRunInput = {
  questionIds: string[];
  score: number;
  spent: number;
  earned: number;
};

export async function endRun(
  walletAddress: string,
  input: EndRunInput
): Promise<{ runId: string }> {
  const user = await User.findOne({ walletAddress }).exec();
  if (!user) throw new Error("User not found");

  const questionObjectIds = input.questionIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const run = await GameRun.create({
    user: user._id,
    walletAddress,
    score: input.score,
    spent: input.spent,
    earned: input.earned,
    questions: questionObjectIds,
  });

  await User.updateOne(
    { walletAddress },
    {
      $inc: { totalSpent: input.spent, totalEarned: input.earned },
      $max: { bestScore: input.score },
    }
  ).exec();

  if (questionObjectIds.length > 0) {
    await Question.updateMany(
      { _id: { $in: questionObjectIds }, user: user._id },
      { $set: { gameRun: run._id } }
    ).exec();
  }

  return { runId: run._id.toString() };
}

/** Add run profit to user's credit balance (for stop & wrong flows). */
export async function addProfitToCredits(
  walletAddress: string,
  profitMicroStx: number
): Promise<void> {
  await userService.addCredits(walletAddress, profitMicroStx);
}

const MICRO_STX_PER_STX = 1_000_000;

/** Compute milestone bonus and add to credits; record audit. Returns bonus in STX and tier. */
export async function computeAndAddMilestoneBonus(
  walletAddress: string,
  completedLevels: number,
  runId: string
): Promise<{ bonusStx: number; milestoneTier: "70" | "100" | null }> {
  const bonusStx = computeMilestoneBonus(completedLevels);
  if (bonusStx <= 0) {
    return { bonusStx: 0, milestoneTier: null };
  }
  const bonusMicroStx = Math.round(bonusStx * MICRO_STX_PER_STX);
  await userService.addCredits(walletAddress, bonusMicroStx);
  const balance = await creditsService.getBalance(walletAddress);
  await creditsService.recordTransaction(
    walletAddress,
    "milestone_bonus",
    bonusMicroStx,
    balance.creditsMicroStx,
    { refRunId: runId }
  );
  const milestoneTier: "70" | "100" = completedLevels >= MAX_QUESTIONS ? "100" : "70";
  return { bonusStx, milestoneTier };
}
