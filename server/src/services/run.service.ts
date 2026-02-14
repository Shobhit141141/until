import mongoose from "mongoose";
import { User } from "../models/User.js";
import { GameRun } from "../models/GameRun.js";
import { Question } from "../models/Question.js";
import * as userService from "./user.service.js";

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
