import type { UpdateUserProfile, UserDoc } from "../types/user.types.js";
import { User } from "../models/User.js";

export async function findByWallet(
  walletAddress: string
): Promise<UserDoc | null> {
  const doc = await User.findOne({ walletAddress }).lean().exec();
  return doc as UserDoc | null;
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
