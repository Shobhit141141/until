import mongoose from "mongoose";

export type CreditTransactionType = "top_up" | "deduct" | "profit" | "refund" | "withdraw";

const creditTransactionSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ["top_up", "deduct", "profit", "refund", "withdraw"] },
    amountMicroStx: { type: Number, required: true },
    balanceAfterMicroStx: { type: Number, required: true },
    refTxId: { type: String, required: false, index: true },
    refRunId: { type: String, required: false, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, required: false },
  },
  { timestamps: true }
);

creditTransactionSchema.index({ walletAddress: 1, createdAt: -1 });

export const CreditTransaction =
  mongoose.models.CreditTransaction ?? mongoose.model("CreditTransaction", creditTransactionSchema);
