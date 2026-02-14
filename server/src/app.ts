import express from "express";
import cors from "cors";
import morgan from "morgan";
import { categoriesRoutes } from "./routes/categories.routes.js";
import { creditsRoutes } from "./routes/credits.routes.js";
import { leaderboardRoutes } from "./routes/leaderboard.routes.js";
import { nextQuestionRoutes } from "./routes/next-question.routes.js";
import { runRoutes } from "./routes/run.routes.js";
import { userRoutes } from "./routes/user.routes.js";

const app = express();

app.use(cors({ origin: true }));
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/categories", categoriesRoutes);
app.use("/next-question", nextQuestionRoutes);
app.use("/credits", creditsRoutes);
app.use("/users", userRoutes);
app.use("/run", runRoutes);
app.use("/leaderboard", leaderboardRoutes);

export default app;
