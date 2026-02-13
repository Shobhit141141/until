import mongoose from "mongoose";
import { logger } from "./logger.js";

const MONGO_URI = process.env.MONGO_URI ?? "mongodb://localhost:27017/until";

export async function connectDb(): Promise<void> {
  logger.info("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
}
