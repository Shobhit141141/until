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
