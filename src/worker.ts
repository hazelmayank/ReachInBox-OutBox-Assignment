import { logger } from "./config/logger.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { emailWorker } from "./modules/emails/email.worker.js";
import { reconcileScheduledEmails } from "./queues/reconcile.js";

await reconcileScheduledEmails();
logger.info("Email worker started");

async function shutdown(signal: string) {
  logger.info({ signal }, "Graceful worker shutdown started");
  await emailWorker.close();
  await Promise.allSettled([redis.quit(), prisma.$disconnect()]);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
