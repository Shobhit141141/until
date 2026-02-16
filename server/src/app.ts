import express from "express";
import cors from "cors";
import morgan from "morgan";
import { ensureDb } from "./config/db.js";
import { errorResponseLogger } from "./middleware/error-response-logger.js";
import { categoriesRoutes } from "./routes/categories.routes.js";
import { creditsRoutes } from "./routes/credits.routes.js";
import { feedbackRoutes } from "./routes/feedback.routes.js";
import { nextQuestionRoutes } from "./routes/next-question.routes.js";
import { runRoutes } from "./routes/run.routes.js";
import { userRoutes } from "./routes/user.routes.js";

const app = express();

app.use(cors({ origin: true }));
app.use(morgan("dev"));
app.use(express.json());
app.use(errorResponseLogger);

app.get("/", (_req, res) => {
  res.json({
    name: "until-server",
    version: "1.0.0",
    description: "UNTIL — skill-based quiz API. Pay per question (STX), credits, optimal stopping.",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/** Ensure MongoDB is connected before any route that uses the DB (handles serverless cold start). */
app.use(async (_req, _res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    next(err);
  }
});

app.use("/categories", categoriesRoutes);
app.use("/next-question", nextQuestionRoutes);
app.use("/credits", creditsRoutes);
app.use("/users", userRoutes);
app.use("/run", runRoutes);
app.use("/feedback", feedbackRoutes);

export default app;
