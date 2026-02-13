import { User } from "../models/User.js";

export type LeaderboardEntry = {
  walletAddress: string;
  username: string | null;
  pfpUrl: string | null;
  bestScore: number;
};

export async function getLeaderboard(
  limit: number = 50
): Promise<LeaderboardEntry[]> {
  const users = await User.find({})
    .sort({ bestScore: -1 })
    .limit(Math.min(limit, 100))
    .lean()
    .exec();
  return users.map((u) => ({
    walletAddress: u.walletAddress,
    username: u.username ?? null,
    pfpUrl: u.pfp ?? null,
    bestScore: u.bestScore ?? 0,
  }));
}
