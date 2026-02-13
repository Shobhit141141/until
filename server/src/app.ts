import express from "express";
import { leaderboardRoutes } from "./routes/leaderboard.routes.js";
import { nextQuestionRoutes } from "./routes/next-question.routes.js";
import { runRoutes } from "./routes/run.routes.js";
import { userRoutes } from "./routes/user.routes.js";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/next-question", nextQuestionRoutes);
app.use("/users", userRoutes);
app.use("/run", runRoutes);
app.use("/leaderboard", leaderboardRoutes);

export default app;
