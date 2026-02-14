import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    difficulty: { type: Number, required: true },
    estimated_solve_time_sec: { type: Number, required: true },
    confidence_score: { type: Number, required: true },
    level: { type: Number, required: false },
    topic: { type: String, required: false },
    prompt_hash: { type: String, required: false },
    tx_id: { type: String, required: false },
    nonce: { type: String, required: false },
    gameRun: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GameRun",
      required: false,
      index: true,
    },
  },
  { timestamps: true }
);

questionSchema.index({ prompt_hash: 1 });
questionSchema.index({ user: 1, createdAt: -1 });

export const Question =
  mongoose.models.Question ?? mongoose.model("Question", questionSchema);
