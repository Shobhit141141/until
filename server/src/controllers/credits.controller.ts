import type { Request, Response } from "express";
import * as creditsService from "../services/credits.service.js";
import * as stacksService from "../services/stacks.service.js";
import { STACKS_RECIPIENT_ADDRESS, isValidStacksAddress } from "../config/stacks.js";
import { getTopUpSuggestedMicroStx } from "../config/tokenomics.js";
import { logger, logTransaction } from "../config/logger.js";

const MICRO_STX_PER_STX = 1_000_000;

/** GET /credits/top-up-info: recipient and suggested amount for one-time top-up. */
export async function topUpInfo(req: Request, res: Response): Promise<void> {
  const recipient = (STACKS_RECIPIENT_ADDRESS || "").trim();
  if (!recipient) {
    res.status(503).json({ error: "Platform recipient not configured" });
    return;
  }
  const suggestedMicroStx = getTopUpSuggestedMicroStx();
  res.json({
    recipient,
    suggestedAmountMicroStx: Number(suggestedMicroStx),
    suggestedAmountStx: Number(suggestedMicroStx) / MICRO_STX_PER_STX,
  });
}

/** GET /credits/balance?walletAddress=... */
export async function getBalance(req: Request, res: Response): Promise<void> {
  const walletAddress = (req.query.walletAddress as string)?.trim();
  if (!walletAddress) {
    res.status(400).json({ error: "walletAddress query required" });
    return;
  }
  if (!isValidStacksAddress(walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }
  const balance = await creditsService.getBalance(walletAddress);
  res.json({
    creditsStx: balance.creditsStx,
    creditsMicroStx: balance.creditsMicroStx,
  });
}

/** GET /credits/history?walletAddress=...&limit=50 — audit trail. */
export async function getHistory(req: Request, res: Response): Promise<void> {
  const walletAddress = (req.query.walletAddress as string)?.trim();
  if (!walletAddress) {
    res.status(400).json({ error: "walletAddress query required" });
    return;
  }
  if (!isValidStacksAddress(walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const transactions = await creditsService.getHistory(walletAddress, limit);
  res.json({ transactions });
}

/**
 * POST /credits/top-up { txId }
 * Verify STX transfer to platform (must be confirmed/anchored). Only then add to user credits (idempotent by txId).
 * No amount or transaction is written to the DB until the on-chain tx is confirmed.
 */
export async function topUp(req: Request, res: Response): Promise<void> {
  const txId = typeof req.body?.txId === "string" ? req.body.txId.trim() : "";
  if (!txId) {
    res.status(400).json({ error: "txId required" });
    return;
  }

  const recipient = (STACKS_RECIPIENT_ADDRESS || "").trim();
  if (!recipient) {
    res.status(503).json({ error: "Platform recipient not configured" });
    return;
  }

  const verification = await stacksService.verifyTopUp(txId, recipient);
  if (!verification.ok) {
    logger.warn(`Top-up verification failed txId=${txId.slice(0, 8)}... reason=${verification.reason}`);
    const message =
      verification.reason === "Transaction not found"
        ? "Transaction not found. If you just sent it, wait a minute and try again. Use the same network (testnet/mainnet) as this app."
        : verification.reason;
    res.status(402).json({ error: message });
    return;
  }

  try {
    const result = await creditsService.applyTopUp(
      txId,
      verification.senderAddress,
      verification.amountMicroStx
    );
    if (!result.ok) {
      res.status(402).json({ error: result.reason });
      return;
    }
    if ("alreadyApplied" in result && result.alreadyApplied) {
      res.status(200).json({ alreadyApplied: true });
      return;
    }
    if (!("creditsStx" in result)) {
      res.status(500).json({ error: "Failed to apply top-up" });
      return;
    }
    const amountStx = Number(verification.amountMicroStx) / MICRO_STX_PER_STX;
    logTransaction("top_up", verification.senderAddress, amountStx, result.creditsStx, { txId });
    res.status(200).json({
      creditsStx: result.creditsStx,
      creditsMicroStx: result.creditsMicroStx,
    });
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    res.status(500).json({ error: "Failed to apply top-up" });
  }
}

/**
 * POST /credits/withdraw { walletAddress, amountStx }
 * Debit credits. Min 0.01 STX. Actual STX payout is platform responsibility.
 */
export async function withdraw(req: Request, res: Response): Promise<void> {
  const walletAddress = typeof req.body?.walletAddress === "string" ? req.body.walletAddress.trim() : "";
  const amountStx = Number(req.body?.amountStx);

  if (!walletAddress) {
    res.status(400).json({ error: "walletAddress required" });
    return;
  }
  if (!isValidStacksAddress(walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }

  const result = await creditsService.withdraw(walletAddress, amountStx);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }

  logTransaction("withdraw", walletAddress, -result.withdrawnStx, result.creditsStx);

  res.json({
    creditsStx: result.creditsStx,
    withdrawnStx: result.withdrawnStx,
    txId: result.txId,
    message: result.txId
      ? `Sent ${result.withdrawnStx} STX to your wallet. Tx: ${result.txId}`
      : `Withdrew ${result.withdrawnStx} STX credits.`,
  });
}
