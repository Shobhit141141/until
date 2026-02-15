import { Router } from "express";
import { QUESTION_CATEGORIES, CATEGORY_METADATA, isValidCategory } from "../config/categories.js";
import { getCategorySamples } from "../data/category-sample-questions.js";

const router = Router();

/** GET /categories — list of category names and full metadata (description, rules, difficulty_scaling, example). */
router.get("/", (_req, res) => {
  res.json({
    categories: [...QUESTION_CATEGORIES],
    metadata: CATEGORY_METADATA,
  });
});

/** GET /categories/:category/samples — static sample questions (2 sets) for "get to know the category" pages. */
router.get("/:category/samples", (req, res) => {
  const category = decodeURIComponent(req.params.category);
  if (!isValidCategory(category)) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const samples = getCategorySamples(category);
  if (!samples) {
    res.status(404).json({ error: "No samples for this category" });
    return;
  }
  res.json(samples);
});

export const categoriesRoutes = router;
