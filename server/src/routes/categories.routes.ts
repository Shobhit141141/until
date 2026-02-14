import { Router } from "express";
import { QUESTION_CATEGORIES } from "../config/categories.js";

const router = Router();

/** GET /categories — server-side categories only. Client must use one of these (no custom). */
router.get("/", (_req, res) => {
  res.json({ categories: [...QUESTION_CATEGORIES] });
});

export const categoriesRoutes = router;
