import { Router } from "express";
import * as userController from "../controllers/user.controller.js";

const router = Router();

router.get("/me", userController.getMe);
router.get("/check-username", userController.checkUsername);
router.patch("/me", userController.updateMe);
router.get("/:walletAddress", userController.getByWallet);
router.patch("/:walletAddress", userController.updateProfile);

export const userRoutes = router;
