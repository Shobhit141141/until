import { Router } from "express";
import * as feedbackController from "../controllers/feedback.controller.js";

export const feedbackRoutes = Router();
feedbackRoutes.post("/", feedbackController.submitFeedback);
