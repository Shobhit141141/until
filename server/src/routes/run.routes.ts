import { Router } from "express";
import * as runController from "../controllers/run.controller.js";

const router = Router();

router.post("/end", runController.endRun);

export const runRoutes = router;
