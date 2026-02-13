import { Router } from "express";
import * as leaderboardController from "../controllers/leaderboard.controller.js";

const router = Router();

router.get("/", leaderboardController.getLeaderboard);

export const leaderboardRoutes = router;
