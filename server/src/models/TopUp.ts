import mongoose from "mongoose";

const topUpSchema = new mongoose.Schema(
  {
    txId: { type: String, required: true, unique: true, index: true },
    walletAddress: { type: String, required: true, index: true },
    amountMicroStx: { type: Number, required: true },
  },
  { timestamps: true }
);

export const TopUp =
  mongoose.models.TopUp ?? mongoose.model("TopUp", topUpSchema);
