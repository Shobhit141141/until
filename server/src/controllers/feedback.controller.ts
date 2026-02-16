import type { Request, Response } from "express";
import * as feedbackService from "../services/feedback.service.js";

export async function submitFeedback(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    fromIdentifier?: string;
    email?: string;
    query?: string;
    proposedSolution?: string;
  };
  const fromIdentifier = typeof body.fromIdentifier === "string" ? body.fromIdentifier.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : undefined;
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const proposedSolution = typeof body.proposedSolution === "string" ? body.proposedSolution.trim() : undefined;

  if (!fromIdentifier || !query) {
    res.status(400).json({
      error: "fromIdentifier (wallet or username) and query are required",
    });
    return;
  }

  if (query.length > 5000) {
    res.status(400).json({ error: "Query is too long" });
    return;
  }

  const result = await feedbackService.sendFeedbackEmail({
    fromIdentifier,
    email: email || undefined,
    query,
    proposedSolution: proposedSolution || undefined,
  });

  if (!result.ok) {
    res.status(503).json({
      error: "Failed to send feedback. Please try again or email us directly.",
    });
    return;
  }

  res.status(200).json({ ok: true, message: "Thank you for your feedback." });
}

export async function submitReport(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    name?: string;
    email?: string;
    issue?: string;
    proposedSolution?: string;
    runId?: string | null;
    questionText?: string;
    options?: string[];
    userAnswerText?: string;
    walletAddress?: string | null;
  };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : undefined;
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 254) : undefined;
  const issue = typeof body.issue === "string" ? body.issue.trim() : "";
  const proposedSolution = typeof body.proposedSolution === "string" ? body.proposedSolution.trim().slice(0, 2000) : undefined;
  const runId = body.runId != null ? String(body.runId).slice(0, 100) : undefined;
  const questionText = typeof body.questionText === "string" ? body.questionText.slice(0, 2000) : undefined;
  const options = Array.isArray(body.options) ? body.options.slice(0, 4).map((o) => String(o).slice(0, 500)) : undefined;
  const userAnswerText = typeof body.userAnswerText === "string" ? body.userAnswerText.slice(0, 500) : undefined;
  const walletAddress = body.walletAddress != null ? String(body.walletAddress).slice(0, 100) : undefined;

  if (!issue) {
    res.status(400).json({ error: "Issue / description is required" });
    return;
  }
  if (issue.length > 5000) {
    res.status(400).json({ error: "Issue is too long" });
    return;
  }

  const result = await feedbackService.sendReportEmail({
    name: name || undefined,
    email: email || undefined,
    issue,
    proposedSolution: proposedSolution || undefined,
    runId: runId || undefined,
    questionText,
    options,
    userAnswerText,
    walletAddress: walletAddress || undefined,
  });

  if (!result.ok) {
    res.status(503).json({ error: "Failed to send report. Please try again." });
    return;
  }

  res.status(200).json({ ok: true, message: "Report sent. Thank you." });
}
