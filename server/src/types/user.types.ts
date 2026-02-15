import type { Types } from "mongoose";

export type UpdateUserProfile = {
  username?: string;
  pfpUrl?: string;
};

export type UserDoc = {
  _id: Types.ObjectId;
  walletAddress: string;
  username?: string | null;
  pfp?: string | null;
  totalSpent: number;
  totalEarned: number;
  bestScore: number;
  creditsMicroStx: number;
  /** Beta: category name -> number of paid runs started (max 2 per category). */
  categoryPlayCount?: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
};

export type UserResponse = {
  walletAddress: string;
  username: string | null;
  pfpUrl: string | null;
  totalSpent: number;
  totalEarned: number;
  bestScore: number;
  creditsStx: number;
  createdAt: string;
  updatedAt: string;
};
