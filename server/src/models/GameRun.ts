import mongoose from "mongoose";

const gameRunSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true },
    score: { type: Number, required: true },
    spent: { type: Number, required: true },
    earned: { type: Number, required: true },
  },
  { timestamps: true }
);

export const GameRun =
  mongoose.models.GameRun ?? mongoose.model("GameRun", gameRunSchema);
