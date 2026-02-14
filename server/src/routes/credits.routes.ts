import { Router } from "express";
import * as creditsController from "../controllers/credits.controller.js";

const router = Router();

router.get("/top-up-info", creditsController.topUpInfo);
router.get("/balance", creditsController.getBalance);
router.get("/history", creditsController.getHistory);
router.post("/top-up", creditsController.topUp);
router.post("/withdraw", creditsController.withdraw);

export const creditsRoutes = router;
