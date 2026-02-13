import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: false, unique: true, sparse: true },
    pfp: { type: String, required: false },
  },
  { timestamps: true }
);

export const User =
  mongoose.models.User ?? mongoose.model("User", userSchema);
