import { Router } from "express";
import { QUESTION_CATEGORIES, CATEGORY_METADATA } from "../config/categories.js";

const router = Router();

/** GET /categories — list of category names and full metadata (description, rules, difficulty_scaling, example). */
router.get("/", (_req, res) => {
  res.json({
    categories: [...QUESTION_CATEGORIES],
    metadata: CATEGORY_METADATA,
  });
});

export const categoriesRoutes = router;
