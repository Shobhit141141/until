import type { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger.js";

function logErrorResponse(req: Request, res: Response, body: unknown): void {
  const status = res.statusCode;
  if (status < 400) return;
  const errorMsg =
    body && typeof body === "object" && "error" in body
      ? (body as { error?: string }).error
      : typeof body === "object"
        ? JSON.stringify(body)
        : String(body);
  logger.warn(`[${req.method} ${req.path}] ${status} — ${errorMsg}`);
}

/**
 * Logs every 4xx/5xx response with method, path, status, and body so you can see
 * why requests fail in the terminal without inspecting the network tab.
 */
export function errorResponseLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown): Response {
    logErrorResponse(req, res, body);
    return originalJson(body);
  };
  const originalSend = res.send.bind(res);
  res.send = function (body: unknown): Response {
    if (res.statusCode >= 400 && body !== undefined) {
      const preview = typeof body === "string" ? body.slice(0, 200) : String(body).slice(0, 200);
      logger.warn(`[${req.method} ${req.path}] ${res.statusCode} — ${preview}${String(body).length > 200 ? "…" : ""}`);
    }
    return originalSend(body);
  };
  next();
}
