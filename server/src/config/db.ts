import mongoose from "mongoose";
import { logger } from "./logger.js";

const MONGO_URI = process.env.MONGO_URI ?? "mongodb://localhost:27017/until";

const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 20000,
  bufferTimeoutMS: 30000,
};

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connectionPromise: Promise<void> | null = null;
let listenersAttached = false;

async function connect(): Promise<void> {
  await mongoose.connect(MONGO_URI, CONNECT_OPTIONS);
}

function attachListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on("disconnected", () => {
    if (reconnectTimer) return;
    logger.warn("MongoDB disconnected; reconnecting in 2s...");
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectionPromise = connect()
        .then(() => logger.info("MongoDB reconnected"))
        .catch((err) => { logger.error("MongoDB reconnect failed:", err.message); })
        .then(() => undefined);
    }, 2000);
  });
  mongoose.connection.on("error", (err) => {
    logger.error("MongoDB connection error:", err.message);
  });
}

export async function connectDb(): Promise<void> {
  if (process.env.NODE_ENV === "production" && !process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required in production");
  }
  if (mongoose.connection.readyState === 1) return;
  if (connectionPromise) return connectionPromise;
  logger.info("Connecting to MongoDB...");
  attachListeners();
  connectionPromise = connect();
  await connectionPromise;
  logger.info("MongoDB connected");
}

/** Await before any DB operation (e.g. in serverless so first request connects first). */
export async function ensureDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  if (connectionPromise) return connectionPromise;
  return connectDb();
}

/** Call before DB operations in cold-start / serverless to ensure we're connected. */
export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
