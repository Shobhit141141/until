import "dotenv/config";
import app from "./app.js";
import { connectDb } from "./config/db.js";
import { connectRedis } from "./config/redis.js";
import { logger } from "./config/logger.js";

const PORT = Number(process.env.PORT) || 3000;

async function main() {
  logger.info("Starting...");
  await connectDb();
  logger.info("DB connected");
  await connectRedis();
  app.listen(PORT, () => logger.info(`Listening on http://localhost:${PORT}`));
}

main().catch((err) => logger.error(err));
