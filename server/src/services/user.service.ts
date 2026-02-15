import type { UpdateUserProfile, UserDoc } from "../types/user.types.js";
import { User } from "../models/User.js";

export async function findByWallet(
  walletAddress: string
): Promise<UserDoc | null> {
  const doc = await User.findOne({ walletAddress }).lean().exec();
  return doc as UserDoc | null;
}

/** Check if username is available (not taken by another user). Empty username is invalid. */
export async function isUsernameAvailable(
  username: string,
  excludeWalletAddress: string
): Promise<boolean> {
  const name = username?.trim();
  if (!name) return false;
  const existing = await User.findOne({
    username: name,
    walletAddress: { $ne: excludeWalletAddress },
  })
    .select("_id")
    .lean()
    .exec();
  return existing == null;
}

export async function updateProfile(
  walletAddress: string,
  data: UpdateUserProfile
): Promise<UserDoc | null> {
  const update: Record<string, string | undefined> = {};
  if (data.username !== undefined) update.username = data.username;
  if (data.pfpUrl !== undefined) update.pfp = data.pfpUrl;

  const doc = await User.findOneAndUpdate(
    { walletAddress },
    { $set: update },
    { new: true, runValidators: true }
  )
    .lean()
    .exec();

  return doc as UserDoc | null;
}

export async function createUser(
  walletAddress: string,
  username?: string
): Promise<UserDoc> {
  const user = await User.create({
    walletAddress,
    username: username ?? undefined,
  });
  return user.toObject() as UserDoc;
}

export async function findOrCreateUser(
  walletAddress: string
): Promise<UserDoc> {
  const existing = await User.findOne({ walletAddress }).lean().exec();
  if (existing) return existing as unknown as UserDoc;
  const shortId = Math.random().toString(36).slice(2, 8);
  return createUser(walletAddress, `anon_${shortId}`);
}

/** Add credits (top-up or profit). deltaMicroStx can be negative (e.g. withdraw). */
export async function addCredits(
  walletAddress: string,
  deltaMicroStx: number
): Promise<UserDoc | null> {
  const doc = await User.findOneAndUpdate(
    { walletAddress },
    { $inc: { creditsMicroStx: deltaMicroStx } },
    { new: true, runValidators: true }
  )
    .lean()
    .exec();
  return doc as UserDoc | null;
}

/** Get current credits in microSTX. Returns 0 if user not found. */
export async function getCreditsMicroStx(walletAddress: string): Promise<number> {
  const doc = await User.findOne({ walletAddress })
    .select("creditsMicroStx")
    .lean()
    .exec();
  return (doc as { creditsMicroStx?: number } | null)?.creditsMicroStx ?? 0;
}

/** Deduct credits if sufficient. Returns true if deducted, false if insufficient or user not found. */
export async function deductCreditsIfSufficient(
  walletAddress: string,
  amountMicroStx: number
): Promise<boolean> {
  const doc = await User.findOneAndUpdate(
    {
      walletAddress,
      $expr: { $gte: [{ $ifNull: ["$creditsMicroStx", 0] }, amountMicroStx] },
    },
    { $inc: { creditsMicroStx: -amountMicroStx } },
    { new: true }
  )
    .lean()
    .exec();
  return doc != null;
}

const MAX_CATEGORY_PLAYS_BETA = 2;

/** Get how many paid runs the user has started for this category (beta: max 2). */
export async function getCategoryPlayCount(
  walletAddress: string,
  category: string
): Promise<number> {
  const doc = await User.findOne({ walletAddress })
    .select("categoryPlayCount")
    .lean()
    .exec();
  const counts = (doc as { categoryPlayCount?: Record<string, number> } | null)?.categoryPlayCount;
  if (!counts || typeof counts !== "object") return 0;
  const n = counts[category];
  return typeof n === "number" ? n : 0;
}

/** Increment category play count (call when starting a new paid run for that category). */
export async function incrementCategoryPlayCount(
  walletAddress: string,
  category: string
): Promise<void> {
  const key = `categoryPlayCount.${category}`;
  await User.findOneAndUpdate(
    { walletAddress },
    { $inc: { [key]: 1 } },
    { upsert: false }
  ).exec();
}

export function getMaxCategoryPlaysBeta(): number {
  if (process.env.NODE_ENV === "development") return Number.MAX_SAFE_INTEGER;
  return MAX_CATEGORY_PLAYS_BETA;
}
