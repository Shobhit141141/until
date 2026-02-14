import { Router } from "express";
import * as runController from "../controllers/run.controller.js";
import * as answerController from "../controllers/answer.controller.js";
import * as runStopController from "../controllers/run-stop.controller.js";

const router = Router();

router.get("/history", runController.getHistory);
router.post("/submit-answer", answerController.submitAnswer);
router.post("/stop", runStopController.stopRun);
router.post("/end", runController.endRun);

export const runRoutes = router;
