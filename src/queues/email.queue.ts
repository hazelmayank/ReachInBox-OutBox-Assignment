import { Queue } from "bullmq";
import { env } from "../config/env.js";
import { createRedisConnection } from "../lib/redis.js";
import type { EmailJobData } from "../types/domain.js";

export const EMAIL_QUEUE_NAME = "email-delivery";

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: createRedisConnection(),
  prefix: env.QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: env.JOB_ATTEMPTS,
    backoff: { type: "exponential", delay: env.JOB_BACKOFF_MS },
    removeOnComplete: { age: 24 * 60 * 60, count: 10_000 },
    removeOnFail: { age: 7 * 24 * 60 * 60, count: 10_000 }
  }
});

export async function enqueueEmail(scheduledEmailId: string, scheduledAt: Date) {
  return emailQueue.add(
    "send-email",
    { scheduledEmailId },
    {
      jobId: scheduledEmailId,
      delay: Math.max(0, scheduledAt.getTime() - Date.now())
    }
  );
}
