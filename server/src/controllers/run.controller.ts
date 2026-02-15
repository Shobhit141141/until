import type { Request, Response } from "express";
import * as runService from "../services/run.service.js";
import { isValidStacksAddress } from "../config/stacks.js";

/** GET /run/history?walletAddress=...&limit=20 — run history with per-question details. */
export async function getHistory(req: Request, res: Response): Promise<void> {
  const walletAddress = (req.query.walletAddress as string)?.trim();
  if (!walletAddress) {
    res.status(400).json({ error: "walletAddress query required" });
    return;
  }
  if (!isValidStacksAddress(walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  try {
    const runs = await runService.getRunHistory(walletAddress, limit);
    res.json({ runs });
  } catch (err) {
    if (err instanceof Error && err.message === "User not found") {
      res.status(404).json({ error: "User not found" });
      return;
    }
    throw err;
  }
}

export async function endRun(req: Request, res: Response): Promise<void> {
  const { wallet, questionIds, score, spent, earned } = req.body as {
    wallet?: string;
    questionIds?: string[];
    score?: number;
    spent?: number;
    earned?: number;
  };
  const walletAddress = typeof wallet === "string" ? wallet.trim() : "";
  if (!walletAddress) {
    res.status(400).json({ error: "wallet required" });
    return;
  }
  if (!isValidStacksAddress(walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }
  if (!Array.isArray(questionIds)) {
    res.status(400).json({ error: "questionIds array required" });
    return;
  }
  const s = Number(score);
  const sp = Number(spent);
  const e = Number(earned);
  if (!Number.isFinite(s) || !Number.isFinite(sp) || !Number.isFinite(e)) {
    res.status(400).json({ error: "score, spent, earned must be numbers" });
    return;
  }
  try {
    const result = await runService.endRun(walletAddress, {
      questionIds,
      score: s,
      spent: sp,
      earned: e,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "User not found") {
      res.status(404).json({ error: "User not found" });
      return;
    }
    throw err;
  }
}
