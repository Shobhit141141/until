import { Router } from "express";
import * as userController from "../controllers/user.controller.js";

const router = Router();

router.get("/:walletAddress", userController.getByWallet);
router.patch("/:walletAddress", userController.updateProfile);

export const userRoutes = router;
