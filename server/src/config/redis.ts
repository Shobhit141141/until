import { Redis } from "ioredis";
import { logger } from "./logger.js";

const REDIS_URL = process.env.REDIS_URL?.trim();

let client: Redis | null = null;

export function getRedis(): Redis | null {
  return client;
}

export async function connectRedis(): Promise<Redis | null> {
  if (!REDIS_URL) {
    logger.info("REDIS_URL not set; challenge store will use in-memory");
    return null;
  }
  try {
    client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
    client.on("error", (err: Error) => logger.warn("Redis error", { err: String(err) }));
    await client.ping();
    logger.info("Redis connected");
    return client;
  } catch (err) {
    logger.warn("Redis connect failed; challenge store will use in-memory", { err: String(err) });
    client = null;
    return null;
  }
}

export function isRedisEnabled(): boolean {
  return client != null;
}
