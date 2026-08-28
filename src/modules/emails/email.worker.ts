import { DelayedError, Worker } from "bullmq";
import { EmailStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../lib/prisma.js";
import { createRedisConnection } from "../../lib/redis.js";
import { indexEmail } from "../../lib/elasticsearch.js";
import { EMAIL_QUEUE_NAME } from "../../queues/email.queue.js";
import type { EmailJobData } from "../../types/domain.js";
import { notifyRateLimitHit } from "../integrations/slack.service.js";
import { sendEmail } from "./mailer.js";
import { claimSendSlot, releaseNotificationClaim } from "./rate-limiter.js";
import { effectiveDeliveryPolicy } from "./scheduling-policy.js";

export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job, token) => {
    const email = await prisma.scheduledEmail.findUnique({
      where: { id: job.data.scheduledEmailId },
      include: { campaign: { include: { sender: true } } }
    });
    if (!email || email.status === EmailStatus.SENT) return;
    if (email.status === EmailStatus.FAILED) return;

    const policy = effectiveDeliveryPolicy(
      email.campaign.delayMs, email.campaign.hourlyLimit,
      env.MIN_SEND_DELAY_MS, env.DEFAULT_MAX_EMAILS_PER_HOUR
    );
    const limit = policy.hourlyLimit;
    const slot = await claimSendSlot(email.campaign.senderId, limit, policy.delayMs);
    if (slot.delayMs > 0) {
      const runAt = Date.now() + slot.delayMs + email.sequence % 100;
      if (slot.hourlyLimitHit && slot.shouldNotify) {
        const notification = await notifyRateLimitHit(email.campaign.userId, email.campaign.sender.email, limit, slot.nextHour);
        if (!notification.sent) await releaseNotificationClaim(email.campaign.senderId, slot.nextHour);
      }
      await prisma.scheduledEmail.update({ where: { id: email.id }, data: { scheduledAt: new Date(runAt), status: EmailStatus.SCHEDULED } });
      await job.moveToDelayed(runAt, token);
      throw new DelayedError();
    }

    const claimed = await prisma.scheduledEmail.updateMany({
      where: { id: email.id, status: { in: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING] } },
      data: { status: EmailStatus.PROCESSING, attemptCount: { increment: 1 }, lastError: null }
    });
    if (claimed.count === 0) return;

    try {
      const delivery = await sendEmail(email.campaign.sender, email.recipient, email.campaign.subject, email.campaign.bodyHtml);
      const sentAt = new Date();
      await prisma.scheduledEmail.update({
        where: { id: email.id },
        data: { status: EmailStatus.SENT, sentAt, providerId: delivery.messageId, previewUrl: delivery.previewUrl }
      });
      await indexEmail({
        id: email.id, userId: email.campaign.userId, campaignId: email.campaignId,
        recipient: email.recipient, subject: email.campaign.subject, status: "SENT",
        scheduledAt: email.scheduledAt, sentAt
      });
    } catch (error) {
      await prisma.scheduledEmail.update({
        where: { id: email.id },
        data: { status: EmailStatus.SCHEDULED, lastError: error instanceof Error ? error.message : "Unknown delivery error" }
      });
      throw error;
    }
  },
  { connection: createRedisConnection(), prefix: env.QUEUE_PREFIX, concurrency: env.WORKER_CONCURRENCY }
);

emailWorker.on("completed", (job) => logger.info({ jobId: job.id }, "Email job completed"));
emailWorker.on("failed", async (job, error) => {
  logger.error({ jobId: job?.id, err: error }, "Email job attempt failed");
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await prisma.scheduledEmail.updateMany({
      where: { id: job.data.scheduledEmailId, status: { not: EmailStatus.SENT } },
      data: { status: EmailStatus.FAILED, failedAt: new Date(), lastError: error.message }
    });
  }
});
