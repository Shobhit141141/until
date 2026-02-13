import type { Request, Response } from "express";
import * as userService from "../services/user.service.js";
import type { UserDoc, UserResponse } from "../types/user.types.js";

function toResponse(doc: UserDoc): UserResponse {
  return {
    walletAddress: doc.walletAddress,
    username: doc.username ?? null,
    pfpUrl: doc.pfp ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
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
