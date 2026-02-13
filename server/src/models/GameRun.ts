import mongoose from "mongoose";

const gameRunSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    walletAddress: { type: String, required: true, index: true },
    score: { type: Number, required: true },
    spent: { type: Number, required: true },
    earned: { type: Number, required: true },
    questions: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
    ],
  },
  { timestamps: true }
);

export const GameRun =
  mongoose.models.GameRun ?? mongoose.model("GameRun", gameRunSchema);
