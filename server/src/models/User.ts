import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: false, unique: true, sparse: true },
    pfp: { type: String, required: false },
    totalSpent: { type: Number, required: true, default: 0 },
    totalEarned: { type: Number, required: true, default: 0 },
    bestScore: { type: Number, required: true, default: 0 },
    /** Credits balance in microSTX (1 STX = 1e6). Used for pay-from-balance flow. */
    creditsMicroStx: { type: Number, required: true, default: 0 },
    /** Beta: number of paid runs started per category. Max 2 per category. Keys = category name, value = count. */
    categoryPlayCount: { type: mongoose.Schema.Types.Mixed, required: false, default: {} },
  },
  { timestamps: true }
);

export const User = mongoose.models.User ?? mongoose.model("User", userSchema);
