import nodemailer from "nodemailer";
import { logger } from "../config/logger.js";

export type FeedbackPayload = {
  /** Wallet address or username (identifier from user). */
  fromIdentifier: string;
  /** Optional email for reply. */
  email?: string;
  /** The feedback message / query. */
  query: string;
  /** Optional proposed solution. */
  proposedSolution?: string;
};

export type ReportPayload = {
  /** Reporter name (optional). */
  name?: string;
  /** Reporter email (optional, for reply). */
  email?: string;
  /** Issue / description (required). */
  issue: string;
  /** Proposed solution (optional). */
  proposedSolution?: string;
  /** Run ID. */
  runId?: string | null;
  /** Question text. */
  questionText?: string;
  /** Options A–D. */
  options?: string[];
  /** User's selected answer text. */
  userAnswerText?: string;
  /** Wallet address. */
  walletAddress?: string | null;
};

const FEEDBACK_TO = process.env.FEEDBACK_EMAIL_TO ?? "";
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? "";

/** Port 465 = implicit TLS (secure: true). Port 587 or 25 = STARTTLS (secure: false). Avoids "wrong version number" SSL error. */
function getTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  const port = SMTP_PORT || 587;
  const secure = port === 465;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendFeedbackEmail(payload: FeedbackPayload): Promise<{ ok: boolean; error?: string }> {
  if (!FEEDBACK_TO) {
    logger.warn("[feedback] FEEDBACK_EMAIL_TO not set; skipping send");
    return { ok: true };
  }
  const transporter = getTransporter();
  if (!transporter) {
    logger.warn("[feedback] SMTP not configured (SMTP_HOST/USER/PASS); skipping send");
    return { ok: true };
  }
  const body = [
    `From: ${payload.fromIdentifier}`,
    ...(payload.email ? [`Email: ${payload.email}`, ""] : []),
    "",
    "--- Query ---",
    payload.query,
    "",
  ];
  if (payload.proposedSolution?.trim()) {
    body.push("--- Proposed solution (optional) ---", payload.proposedSolution.trim(), "");
  }
  body.push("---", `Sent at: ${new Date().toISOString()}`);

  const replyTo = payload.email?.includes("@") ? payload.email : payload.fromIdentifier.includes("@") ? payload.fromIdentifier : undefined;

  try {
    await transporter.sendMail({
      from: `UNTIL Feedback <${SMTP_USER}>`,
      to: FEEDBACK_TO,
      replyTo,
      subject: `[UNTIL Feedback] ${payload.query.slice(0, 60)}${payload.query.length > 60 ? "…" : ""}`,
      text: body.join("\n"),
    });
    logger.info("[feedback] email sent", { to: FEEDBACK_TO, fromIdentifier: payload.fromIdentifier.slice(0, 12) + "…" });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[feedback] send failed", { err: msg });
    return { ok: false, error: msg };
  }
}

export async function sendReportEmail(payload: ReportPayload): Promise<{ ok: boolean; error?: string }> {
  if (!FEEDBACK_TO) {
    logger.warn("[report] FEEDBACK_EMAIL_TO not set; skipping send");
    return { ok: true };
  }
  const transporter = getTransporter();
  if (!transporter) {
    logger.warn("[report] SMTP not configured; skipping send");
    return { ok: true };
  }
  const opts = payload.options ?? [];
  const body = [
    "--- Report context ---",
    `Run ID: ${payload.runId ?? "—"}`,
    `Wallet: ${payload.walletAddress ?? "—"}`,
    "",
    "Question:",
    payload.questionText ?? "—",
    "",
    "Options:",
    ...opts.slice(0, 4).map((o, i) => `${["A", "B", "C", "D"][i]}: ${o}`),
    "",
    `User's answer: ${payload.userAnswerText ?? "—"}`,
    "",
    "--- Reporter ---",
    ...(payload.name?.trim() ? [`Name: ${payload.name.trim()}`] : []),
    ...(payload.email?.trim() ? [`Email: ${payload.email.trim()}`] : []),
    "",
    "--- Issue ---",
    payload.issue.trim(),
    "",
  ];
  if (payload.proposedSolution?.trim()) {
    body.push("--- Proposed solution ---", payload.proposedSolution.trim(), "");
  }
  body.push("---", `Sent at: ${new Date().toISOString()}`);

  const replyTo = payload.email?.includes("@") ? payload.email : undefined;

  try {
    await transporter.sendMail({
      from: `UNTIL Report <${SMTP_USER}>`,
      to: FEEDBACK_TO,
      replyTo,
      subject: `[UNTIL Report] Run ${payload.runId ?? "?"} – ${payload.issue.slice(0, 40)}${payload.issue.length > 40 ? "…" : ""}`,
      text: body.join("\n"),
    });
    logger.info("[report] email sent", { runId: payload.runId ?? "—" });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[report] send failed", { err: msg });
    return { ok: false, error: msg };
  }
}
