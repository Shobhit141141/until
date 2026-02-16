import mongoose from "mongoose";
import { logger } from "./logger.js";

const MONGO_URI = process.env.MONGO_URI ?? "mongodb://localhost:27017/until";

const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 20000,
  bufferTimeoutMS: 30000,
};

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

async function connect(): Promise<void> {
  await mongoose.connect(MONGO_URI, CONNECT_OPTIONS);
}

export async function connectDb(): Promise<void> {
  if (process.env.NODE_ENV === "production" && !process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required in production");
  }
  logger.info("Connecting to MongoDB...");

  mongoose.connection.on("disconnected", () => {
    if (reconnectTimer) return;
    logger.warn("MongoDB disconnected; reconnecting in 2s...");
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect().then(() => logger.info("MongoDB reconnected")).catch((err) => logger.error("MongoDB reconnect failed:", err.message));
    }, 2000);
  });

  mongoose.connection.on("error", (err) => {
    logger.error("MongoDB connection error:", err.message);
  });

  await connect();
  logger.info("MongoDB connected");
}

/** Call before DB operations in cold-start / serverless to ensure we're connected. */
export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
