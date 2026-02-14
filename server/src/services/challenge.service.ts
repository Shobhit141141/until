import { randomUUID } from "crypto";
import type { ChallengeStoreEntry, PaymentChallengePayload } from "../types/question.types.js";
import { CHALLENGE_EXPIRY_MS } from "../types/question.types.js";
import { STACKS_RECIPIENT_ADDRESS } from "../config/stacks.js";
import { getCostMicroStx } from "../config/tokenomics.js";

const store = new Map<string, ChallengeStoreEntry>();

function getRecipient(): string {
  return STACKS_RECIPIENT_ADDRESS || "";
}

/** Issue 402 challenge for a given difficulty (0–9). Cost from tokenomics curve. */
export function issueChallenge(difficulty: number): PaymentChallengePayload {
  const nonce = randomUUID();
  const priceMicroStx = getCostMicroStx(difficulty);
  const recipient = getRecipient();
  const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_MS);
  store.set(nonce, { priceMicroStx, recipient, used: false, expiresAt });
  return {
    amount: priceMicroStx.toString(),
    recipient,
    nonce,
  };
}

export function getChallenge(nonce: string): ChallengeStoreEntry | null {
  return store.get(nonce) ?? null;
}

export function isChallengeValid(nonce: string): boolean {
  const entry = store.get(nonce);
  if (!entry) return false;
  if (entry.used) return false;
  if (new Date() > entry.expiresAt) return false;
  return true;
}

export function consumeChallenge(nonce: string): ChallengeStoreEntry | null {
  const entry = store.get(nonce);
  if (!entry || entry.used || new Date() > entry.expiresAt) return null;
  entry.used = true;
  store.set(nonce, entry);
  return entry;
}
