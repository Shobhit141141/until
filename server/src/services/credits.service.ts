import { User } from "../models/User.js";
import { TopUp } from "../models/TopUp.js";
import { CreditTransaction } from "../models/CreditTransaction.js";
import type { CreditTransactionType } from "../models/CreditTransaction.js";
import * as userService from "./user.service.js";
import { MIN_WITHDRAW_STX, getMinWithdrawMicroStx } from "../config/tokenomics.js";

const MICRO_STX_PER_STX = 1_000_000;

type LeanUserCredits = { creditsMicroStx?: number };
type LeanTopUp = { walletAddress: string; creditsMicroStx?: number };
type LeanCreditTx = {
  _id: unknown;
  type: CreditTransactionType;
  amountMicroStx: number;
  balanceAfterMicroStx: number;
  refTxId?: string;
  refRunId?: string;
  createdAt: Date;
};

export type CreditTransactionRef = { refTxId?: string; refRunId?: string };

/** Audit trail: record every credit movement. */
export async function recordTransaction(
  walletAddress: string,
  type: CreditTransactionType,
  amountMicroStx: number,
  balanceAfterMicroStx: number,
  ref?: CreditTransactionRef
): Promise<void> {
  await CreditTransaction.create({
    walletAddress,
    type,
    amountMicroStx,
    balanceAfterMicroStx,
    refTxId: ref?.refTxId,
    refRunId: ref?.refRunId,
  });
}

export type CreditsBalance = { creditsMicroStx: number; creditsStx: number };

/** Get current credits balance for a wallet. Returns 0 if user not found. */
export async function getBalance(walletAddress: string): Promise<CreditsBalance> {
  const user = (await User.findOne({ walletAddress })
    .select("creditsMicroStx")
    .lean()
    .exec()) as LeanUserCredits | null;
  const micro = user?.creditsMicroStx ?? 0;
  return {
    creditsMicroStx: micro,
    creditsStx: micro / MICRO_STX_PER_STX,
  };
}

/** Add credits (e.g. after top-up or run profit). Returns new balance. */
export async function addCredits(
  walletAddress: string,
  amountMicroStx: bigint
): Promise<CreditsBalance> {
  const user = await userService.findOrCreateUser(walletAddress);
  const amount = Number(amountMicroStx);
  const updated = await User.findOneAndUpdate(
    { walletAddress },
    { $inc: { creditsMicroStx: amount } },
    { new: true, runValidators: true }
  )
    .select("creditsMicroStx")
    .lean()
    .exec();
  if (!updated) throw new Error("User not found");
  const micro = (updated as LeanUserCredits).creditsMicroStx ?? 0;
  return {
    creditsMicroStx: micro,
    creditsStx: micro / MICRO_STX_PER_STX,
  };
}

/**
 * Deduct credits for a question. Returns true if deducted, false if insufficient.
 * Caller must use transaction or accept race if needed.
 */
export async function deductCredits(
  walletAddress: string,
  amountMicroStx: bigint
): Promise<{ ok: true; creditsStx: number } | { ok: false; reason: string }> {
  const amount = Number(amountMicroStx);
  if (amount <= 0) return { ok: false, reason: "Amount must be positive" };

  const updated = await User.findOneAndUpdate(
    {
      walletAddress,
      $expr: { $gte: [{ $ifNull: ["$creditsMicroStx", 0] }, amount] },
    },
    { $inc: { creditsMicroStx: -amount } },
    { new: true }
  )
    .select("creditsMicroStx")
    .lean()
    .exec();

  if (!updated) {
    const user = (await User.findOne({ walletAddress }).select("creditsMicroStx").lean().exec()) as LeanUserCredits | null;
    const have = user?.creditsMicroStx ?? 0;
    return {
      ok: false,
      reason: have < amount ? "Insufficient credits" : "User not found",
    };
  }
  const micro = (updated as LeanUserCredits).creditsMicroStx ?? 0;
  return { ok: true, creditsStx: micro / MICRO_STX_PER_STX };
}

export type TopUpResult =
  | { ok: true; creditsStx: number; creditsMicroStx: number }
  | { ok: false; reason: string };

/**
 * Apply a verified top-up tx: idempotent by txId. If txId already applied, returns current balance.
 */
export async function applyTopUp(
  txId: string,
  walletAddress: string,
  amountMicroStx: bigint
): Promise<TopUpResult> {
  const existing = (await TopUp.findOne({ txId }).lean().exec()) as LeanTopUp | null;
  if (existing) {
    const user = (await User.findOne({ walletAddress: existing.walletAddress })
      .select("creditsMicroStx")
      .lean()
      .exec()) as LeanUserCredits | null;
    const micro = user?.creditsMicroStx ?? 0;
    return {
      ok: true,
      creditsMicroStx: micro,
      creditsStx: micro / MICRO_STX_PER_STX,
    };
  }

  await userService.findOrCreateUser(walletAddress);
  const amount = Number(amountMicroStx);
  await TopUp.create({ txId, walletAddress, amountMicroStx: amount });
  const balance = await addCredits(walletAddress, amountMicroStx);
  await recordTransaction(walletAddress, "top_up", amount, balance.creditsMicroStx, { refTxId: txId });
  return {
    ok: true,
    creditsMicroStx: balance.creditsMicroStx,
    creditsStx: balance.creditsStx,
  };
}

export type WithdrawResult =
  | { ok: true; creditsStx: number; withdrawnStx: number }
  | { ok: false; reason: string };

/** Debit credits for withdrawal. Min 0.01 STX. Actual STX payout is out of scope (queue or manual). */
export async function withdraw(
  walletAddress: string,
  amountStx: number
): Promise<WithdrawResult> {
  if (!Number.isFinite(amountStx) || amountStx < MIN_WITHDRAW_STX) {
    return { ok: false, reason: `Minimum withdrawal is ${MIN_WITHDRAW_STX} STX` };
  }
  const amountMicroStx = BigInt(Math.round(amountStx * MICRO_STX_PER_STX));
  if (amountMicroStx < getMinWithdrawMicroStx()) {
    return { ok: false, reason: `Minimum withdrawal is ${MIN_WITHDRAW_STX} STX` };
  }

  const result = await deductCredits(walletAddress, amountMicroStx);
  if (!result.ok) return { ok: false, reason: result.reason };

  const balanceAfterMicroStx = Math.round(result.creditsStx * MICRO_STX_PER_STX);
  await recordTransaction(walletAddress, "withdraw", -Number(amountMicroStx), balanceAfterMicroStx);

  return {
    ok: true,
    creditsStx: result.creditsStx,
    withdrawnStx: amountStx,
  };
}

export type CreditTransactionEntry = {
  id: string;
  type: CreditTransactionType;
  amountMicroStx: number;
  balanceAfterMicroStx: number;
  refTxId?: string;
  refRunId?: string;
  createdAt: string;
};

/** List recent credit transactions for a wallet (audit trail). */
export async function getHistory(
  walletAddress: string,
  limit: number = 50
): Promise<CreditTransactionEntry[]> {
  const docs = await CreditTransaction.find({ walletAddress })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .lean()
    .exec();
  return ((docs as unknown) as LeanCreditTx[]).map((d) => ({
    id: String(d._id),
    type: d.type,
    amountMicroStx: d.amountMicroStx,
    balanceAfterMicroStx: d.balanceAfterMicroStx,
    refTxId: d.refTxId,
    refRunId: d.refRunId,
    createdAt: d.createdAt.toISOString(),
  }));
}
