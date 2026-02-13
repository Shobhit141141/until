import { Router } from "express";
import * as nextQuestionController from "../controllers/next-question.controller.js";

const router = Router();

router.get("/", nextQuestionController.getNextQuestion);
router.post("/", nextQuestionController.submitPaymentAndGetQuestion);

export const nextQuestionRoutes = router;
