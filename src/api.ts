import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { ensureEmailIndex } from "./lib/elasticsearch.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { emailQueue } from "./queues/email.queue.js";
import { reconcileScheduledEmails } from "./queues/reconcile.js";

await ensureEmailIndex();
await reconcileScheduledEmails();
const server = app.listen(env.API_PORT, () => logger.info({ port: env.API_PORT }, "API listening"));

async function shutdown(signal: string) {
  logger.info({ signal }, "Graceful API shutdown started");
  server.close(async () => {
    await Promise.allSettled([emailQueue.close(), redis.quit(), prisma.$disconnect()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
