import type { Request, Response } from "express";
import * as userService from "../services/user.service.js";
import type { UserDoc, UserResponse } from "../types/user.types.js";

function toResponse(doc: UserDoc): UserResponse {
  return {
    walletAddress: doc.walletAddress,
    username: doc.username ?? null,
    pfpUrl: doc.pfp ?? null,
    totalSpent: doc.totalSpent ?? 0,
    totalEarned: doc.totalEarned ?? 0,
    bestScore: doc.bestScore ?? 0,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const wallet = (req.query.wallet as string)?.trim();
  if (!wallet) {
    res.status(400).json({ error: "wallet query required (current user)" });
    return;
  }
  const user = await userService.findByWallet(wallet);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(toResponse(user));
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const { wallet, username, pfpUrl } = req.body as {
    wallet?: string;
    username?: string;
    pfpUrl?: string;
  };
  const walletAddress = typeof wallet === "string" ? wallet.trim() : "";
  if (!walletAddress) {
    res.status(400).json({ error: "wallet required in body (current user)" });
    return;
  }
  try {
    const user = await userService.updateProfile(walletAddress, {
      username,
      pfpUrl,
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(toResponse(user));
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code: number }).code
        : undefined;
    if (code === 11000) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
    throw err;
  }
}

export async function getByWallet(req: Request, res: Response): Promise<void> {
  const { walletAddress } = req.params;
  const user = await userService.findByWallet(walletAddress);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(toResponse(user));
}

export async function updateProfile(
  req: Request,
  res: Response
): Promise<void> {
  const { walletAddress } = req.params;
  const body = req.body as { username?: string; pfpUrl?: string };

  try {
    const user = await userService.updateProfile(walletAddress, {
      username: body.username,
      pfpUrl: body.pfpUrl,
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(toResponse(user));
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code: number }).code
        : undefined;
    if (code === 11000) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
    throw err;
  }
}
