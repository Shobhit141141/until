import { randomUUID } from "crypto";
import type { ChallengeStoreEntry, PaymentChallengePayload } from "../types/question.types.js";
import { CHALLENGE_EXPIRY_MS } from "../types/question.types.js";
import { STACKS_RECIPIENT_ADDRESS } from "../config/stacks.js";
import { getCostMicroStx } from "../config/tokenomics.js";
import { getRedis } from "../config/redis.js";
import { logger } from "../config/logger.js";

const MEMORY_STORE = new Map<string, ChallengeStoreEntry>();

const REDIS_KEY_PREFIX = "challenge:";
const CHALLENGE_TTL_SEC = Math.ceil(CHALLENGE_EXPIRY_MS / 1000);

/** Lua: get challenge, if not used set used=true and SET with PX, return encoded entry; else return nil */
const LUA_CONSUME = `
local v = redis.call('GET', KEYS[1])
if not v then return nil end
local t = cjson.decode(v)
if t.used then return nil end
t.used = true
redis.call('SET', KEYS[1], cjson.encode(t), 'PX', ARGV[1])
return cjson.encode(t)
`;

function nonceTail(nonce: string) {
  return nonce.length >= 8 ? nonce.slice(-8) : nonce;
}

const STACKS_ADDRESS_REGEX = /^S[TP][0-9A-HJ-NP-Za-km-z]{39}$/;

function getRecipient(): string {
  return (STACKS_RECIPIENT_ADDRESS || "").trim();
}

function isValidStacksAddress(addr: string): boolean {
  return STACKS_ADDRESS_REGEX.test(addr);
}

type RedisEntry = {
  priceMicroStx: string;
  recipient: string;
  used: boolean;
  expiresAt: string;
};

function toRedisEntry(e: ChallengeStoreEntry): RedisEntry {
  return {
    priceMicroStx: e.priceMicroStx.toString(),
    recipient: e.recipient,
    used: e.used,
    expiresAt: e.expiresAt.toISOString(),
  };
}

function fromRedisEntry(r: RedisEntry): ChallengeStoreEntry {
  return {
    priceMicroStx: BigInt(r.priceMicroStx),
    recipient: r.recipient,
    used: r.used,
    expiresAt: new Date(r.expiresAt),
  };
}

/** Issue 402 challenge for a given difficulty (0–9). Cost from tokenomics curve. */
export async function issueChallenge(difficulty: number): Promise<PaymentChallengePayload> {
  const recipient = getRecipient();
  if (!recipient || !isValidStacksAddress(recipient)) {
    throw new Error(
      "STACKS_RECIPIENT_ADDRESS must be a valid Stacks address (e.g. SP2... or ST2... for testnet)"
    );
  }
  const nonce = randomUUID();
  const priceMicroStx = getCostMicroStx(difficulty);
  const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_MS);
  const entry: ChallengeStoreEntry = { priceMicroStx, recipient, used: false, expiresAt };

  const redis = getRedis();
  if (redis) {
    const key = REDIS_KEY_PREFIX + nonce;
    await redis.set(key, JSON.stringify(toRedisEntry(entry)), "EX", CHALLENGE_TTL_SEC);
    logger.info(`Challenge issued difficulty=${difficulty} nonceTail=${nonceTail(nonce)} nonceHead=${nonce.slice(0, 8)} store=redis key=${key}`);
  } else {
    MEMORY_STORE.set(nonce, entry);
    logger.info(`Challenge issued difficulty=${difficulty} nonceTail=${nonceTail(nonce)} storeSize=${MEMORY_STORE.size}`);
  }

  return {
    amount: priceMicroStx.toString(),
    recipient,
    nonce,
  };
}

export async function getChallenge(nonce: string): Promise<ChallengeStoreEntry | null> {
  const redis = getRedis();
  if (redis) {
    const key = REDIS_KEY_PREFIX + nonce;
    const raw = await redis.get(key);
    if (!raw) return null;
    try {
      return fromRedisEntry(JSON.parse(raw) as RedisEntry);
    } catch {
      return null;
    }
  }
  return MEMORY_STORE.get(nonce) ?? null;
}

export type ChallengeStatus = "valid" | "not_found" | "used" | "expired";

export async function getChallengeStatus(nonce: string): Promise<ChallengeStatus> {
  const redis = getRedis();
  if (redis) {
    const key = REDIS_KEY_PREFIX + nonce;
    const raw = await redis.get(key);
    if (!raw) {
      logger.info(`Challenge lookup miss nonceTail=${nonceTail(nonce)} nonceHead=${nonce.slice(0, 8)} store=redis key=${key}`);
      return "not_found";
    }
    try {
      const entry = fromRedisEntry(JSON.parse(raw) as RedisEntry);
      if (entry.used) {
        logger.info(`Challenge already used nonceTail=${nonceTail(nonce)}`);
        return "used";
      }
      if (new Date() > entry.expiresAt) {
        logger.info(`Challenge expired nonceTail=${nonceTail(nonce)}`);
        return "expired";
      }
      return "valid";
    } catch {
      return "not_found";
    }
  }

  const entry = MEMORY_STORE.get(nonce);
  if (!entry) {
    logger.info(`Challenge lookup miss nonceTail=${nonceTail(nonce)} storeSize=${MEMORY_STORE.size} storeKeysTail=${[...MEMORY_STORE.keys()].slice(-3).map(nonceTail).join(",")}`);
    return "not_found";
  }
  if (entry.used) {
    logger.info(`Challenge already used nonceTail=${nonceTail(nonce)}`);
    return "used";
  }
  if (new Date() > entry.expiresAt) {
    logger.info(`Challenge expired nonceTail=${nonceTail(nonce)}`);
    return "expired";
  }
  return "valid";
}

export async function isChallengeValid(nonce: string): Promise<boolean> {
  return (await getChallengeStatus(nonce)) === "valid";
}

export async function consumeChallenge(nonce: string): Promise<ChallengeStoreEntry | null> {
  const redis = getRedis();
  if (redis) {
    const key = REDIS_KEY_PREFIX + nonce;
    const result = await redis.eval(LUA_CONSUME, 1, key, CHALLENGE_EXPIRY_MS);
    if (result == null) return null;
    try {
      const entry = fromRedisEntry(JSON.parse(result as string) as RedisEntry);
      logger.info(`Challenge consumed nonceTail=${nonceTail(nonce)} store=redis`);
      return entry;
    } catch {
      return null;
    }
  }

  const entry = MEMORY_STORE.get(nonce);
  if (!entry || entry.used || new Date() > entry.expiresAt) return null;
  entry.used = true;
  MEMORY_STORE.set(nonce, entry);
  logger.info(`Challenge consumed nonceTail=${nonceTail(nonce)}`);
  return entry;
}
