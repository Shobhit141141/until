import { STACKS_API_URL } from "../config/stacks.js";
import type {
  PaymentVerificationExpected,
  PaymentVerificationResult,
  StacksTxApiResponse,
} from "../types/stacks.types.js";

const TX_PATH = "/extended/v1/tx";

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
