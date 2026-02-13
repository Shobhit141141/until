import type { Request, Response } from "express";
import * as leaderboardService from "../services/leaderboard.service.js";

export async function getLeaderboard(
  req: Request,
  res: Response
): Promise<void> {
  const limit = Math.min(
    Math.max(1, Number(req.query.limit) || 50),
    100
  );
  const entries = await leaderboardService.getLeaderboard(limit);
  res.json(entries);
}
