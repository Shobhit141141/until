import { randomUUID } from "crypto";
import type { ChallengeStoreEntry, PaymentChallengePayload } from "../types/question.types.js";
import { CHALLENGE_EXPIRY_MS, QUESTION_PRICE_MICRO_STX } from "../types/question.types.js";
import { STACKS_RECIPIENT_ADDRESS } from "../config/stacks.js";

const store = new Map<string, ChallengeStoreEntry>();

function getDefaultPrice(): bigint {
  const env = process.env.QUESTION_PRICE_MICRO_STX;
  if (env != null && env !== "") return BigInt(env);
  return QUESTION_PRICE_MICRO_STX;
}

function getRecipient(): string {
  return STACKS_RECIPIENT_ADDRESS || "";
}

export function issueChallenge(): PaymentChallengePayload {
  const nonce = randomUUID();
  const priceMicroStx = getDefaultPrice();
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
