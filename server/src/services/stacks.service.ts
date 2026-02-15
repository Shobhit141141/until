import { broadcastTransaction, makeSTXTokenTransfer } from "@stacks/transactions";
import { createNetwork } from "@stacks/network";
import {
  STACKS_API_URL,
  STACKS_NETWORK,
  STACKS_SENDER_SECRET_KEY,
} from "../config/stacks.js";
import type {
  PaymentVerificationExpected,
  PaymentVerificationResult,
  StacksTxApiResponse,
} from "../types/stacks.types.js";

const TX_PATH = "/extended/v1/tx";

export type SendStxResult =
  | { ok: true; txId: string }
  | { ok: false; reason: string };

function getStacksNetwork() {
  return createNetwork({
    network: STACKS_NETWORK,
    client: { baseUrl: STACKS_API_URL },
  });
}

/**
 * Send STX from the platform wallet to a recipient (e.g. withdrawal).
 * Uses @stacks/transactions server-side. Requires STACKS_SENDER_SECRET_KEY and sufficient balance.
 */
export async function sendStx(
  recipientAddress: string,
  amountMicroStx: bigint,
  memo?: string
): Promise<SendStxResult> {
  if (!STACKS_SENDER_SECRET_KEY || !STACKS_SENDER_SECRET_KEY.trim()) {
    return { ok: false, reason: "Withdrawals not configured: STACKS_SENDER_SECRET_KEY not set" };
  }
  if (amountMicroStx <= 0n) {
    return { ok: false, reason: "Amount must be positive" };
  }
  const trimmed = recipientAddress?.trim();
  if (!trimmed || !/^S[TP][0-9A-HJ-NP-Za-km-z]{39}$/.test(trimmed)) {
    return { ok: false, reason: "Invalid recipient address" };
  }

  const network = getStacksNetwork();
  const senderKey = STACKS_SENDER_SECRET_KEY.trim().replace(/^0x/, "");

  try {
    const transaction = await makeSTXTokenTransfer({
      recipient: trimmed,
      amount: amountMicroStx,
      senderKey,
      network,
      memo: memo?.slice(0, 34) ?? undefined,
    });
    const response = await broadcastTransaction({ transaction, network });
    const txId = typeof response.txid === "string" ? response.txid : (response as { txid?: string }).txid;
    if (!txId) {
      return { ok: false, reason: "Broadcast succeeded but no txid returned" };
    }
    return { ok: true, txId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg };
  }
}

function decodeMemo(memo: string | undefined): string {
  if (!memo || !memo.trim()) return "";
  const raw = memo.trim();
  const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
    try {
      return Buffer.from(hex, "hex").toString("utf8");
    } catch {
      return raw;
    }
  }
  return raw;
}

export async function getTransaction(
  txId: string
): Promise<StacksTxApiResponse | null> {
  const url = `${STACKS_API_URL}${TX_PATH}/${encodeURIComponent(txId)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Stacks API error: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as StacksTxApiResponse;
  return data;
}

export async function verifyPayment(
  txId: string,
  expected: PaymentVerificationExpected
): Promise<PaymentVerificationResult> {
  const tx = await getTransaction(txId);
  if (!tx) return { ok: false, reason: "Transaction not found" };

  if (tx.tx_status === "pending") {
    return { ok: false, reason: "Transaction pending" };
  }
  if (tx.tx_status !== "success") {
    return { ok: false, reason: "Transaction not successful" };
  }

  const transfer = tx.token_transfer;
  if (!transfer)
    return { ok: false, reason: "Not an STX transfer transaction" };

  const expectedAmount =
    typeof expected.amountMicroStx === "bigint"
      ? expected.amountMicroStx
      : BigInt(expected.amountMicroStx);
  const actualAmount = BigInt(transfer.amount);
  if (actualAmount !== expectedAmount)
    return { ok: false, reason: "Amount mismatch" };

  if (transfer.recipient_address !== expected.recipientAddress)
    return { ok: false, reason: "Recipient mismatch" };

  const memo = decodeMemo(transfer.memo);
  const noncePrefix = expected.nonce.slice(0, 34);
  if (memo !== "" && memo !== expected.nonce && memo !== noncePrefix)
    return { ok: false, reason: "Nonce (memo) mismatch" };

  return { ok: true, senderAddress: tx.sender_address };
}

export type TopUpVerificationResult =
  | { ok: true; senderAddress: string; amountMicroStx: bigint }
  | { ok: false; reason: string };

/** Verify an STX transfer to platform (for credit top-up). No memo/nonce check. */
export async function verifyTopUp(
  txId: string,
  recipientAddress: string
): Promise<TopUpVerificationResult> {
  const tx = await getTransaction(txId);
  if (!tx) return { ok: false, reason: "Transaction not found" };
  if (tx.tx_status === "pending") return { ok: false, reason: "Transaction pending" };
  if (tx.tx_status !== "success") return { ok: false, reason: "Transaction not successful" };
  const transfer = tx.token_transfer;
  if (!transfer) return { ok: false, reason: "Not an STX transfer transaction" };
  if (transfer.recipient_address !== recipientAddress)
    return { ok: false, reason: "Recipient mismatch" };
  const amountMicroStx = BigInt(transfer.amount);
  if (amountMicroStx <= 0n) return { ok: false, reason: "Amount must be positive" };
  return { ok: true, senderAddress: tx.sender_address, amountMicroStx };
}
