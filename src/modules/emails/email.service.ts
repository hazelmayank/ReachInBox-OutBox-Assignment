import { EmailStatus, Prisma } from "@prisma/client";
import { HttpError } from "../../common/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { emailQueue, enqueueEmail } from "../../queues/email.queue.js";
import type { z } from "zod";
import type { scheduleCampaignSchema } from "./email.schemas.js";
import { scheduledTime } from "./scheduling-policy.js";
import { indexEmails } from "../../lib/elasticsearch.js";

type ScheduleInput = z.infer<typeof scheduleCampaignSchema>;

export async function scheduleCampaign(userId: string, input: ScheduleInput) {
  const sender = await prisma.senderAccount.findFirst({ where: { id: input.senderId, userId, isActive: true } });
  if (!sender) throw new HttpError(404, "Sender account not found");

  const recipients = [...new Set(input.recipients)];
  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.campaign.create({
      data: {
        userId,
        senderId: sender.id,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        startTime: input.startTime,
        delayMs: input.delayMs,
        hourlyLimit: input.hourlyLimit,
        recipientCount: recipients.length
      }
    });
    await tx.scheduledEmail.createMany({
      data: recipients.map((recipient, sequence) => ({
        campaignId: created.id,
        recipient,
        sequence,
        scheduledAt: scheduledTime(input.startTime, sequence, input.delayMs)
      }))
    });
    return created;
  });

  const emails = await prisma.scheduledEmail.findMany({
    where: { campaignId: campaign.id },
    select: { id: true, recipient: true, scheduledAt: true },
    orderBy: { sequence: "asc" }
  });
  try {
    await Promise.all(emails.map((email) => enqueueEmail(email.id, email.scheduledAt)));
  } catch {
    await prisma.scheduledEmail.updateMany({
      where: { campaignId: campaign.id, status: EmailStatus.SCHEDULED },
      data: { lastError: "Queue registration failed; campaign requires reconciliation" }
    });
    throw new HttpError(503, "Campaign was saved but queue registration did not fully complete. Retry safely with the returned campaign id.");
  }
  await indexEmails(emails.map((email) => ({
    id: email.id,
    userId,
    campaignId: campaign.id,
    recipient: email.recipient,
    subject: campaign.subject,
    status: "SCHEDULED",
    scheduledAt: email.scheduledAt,
    sentAt: null
  })));
  return { ...campaign, recipientCount: recipients.length };
}

export async function listEmails(userId: string, query: { status: string; page: number; limit: number; search?: string | undefined }) {
  const statusMap: Record<string, EmailStatus[]> = {
    scheduled: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING],
    sent: [EmailStatus.SENT],
    failed: [EmailStatus.FAILED]
  };
  const where: Prisma.ScheduledEmailWhereInput = {
    campaign: { userId },
    status: { in: statusMap[query.status] ?? [EmailStatus.SCHEDULED] },
    ...(query.search ? {
      OR: [
        { recipient: { contains: query.search, mode: "insensitive" as const } },
        { campaign: { subject: { contains: query.search, mode: "insensitive" as const } } }
      ]
    } : {})
  };
  const [data, total] = await prisma.$transaction([
    prisma.scheduledEmail.findMany({
      where,
      include: { campaign: { select: { subject: true, sender: { select: { name: true, email: true } } } } },
      orderBy: query.status === "sent" ? { sentAt: "desc" } : { scheduledAt: "asc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    }),
    prisma.scheduledEmail.count({ where })
  ]);
  return { data, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } };
}

export async function retryFailedEmail(userId: string, scheduledEmailId: string) {
  const email = await prisma.scheduledEmail.findFirst({
    where: { id: scheduledEmailId, campaign: { userId }, status: EmailStatus.FAILED }
  });
  if (!email) throw new HttpError(404, "Failed email not found");

  const existingJob = await emailQueue.getJob(email.id);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === "active") throw new HttpError(409, "Email job is currently active");
    await existingJob.remove();
  }

  const scheduledAt = new Date(Date.now() + 1_000);
  await prisma.scheduledEmail.update({
    where: { id: email.id },
    data: {
      status: EmailStatus.SCHEDULED,
      scheduledAt,
      failedAt: null,
      lastError: null,
      attemptCount: 0
    }
  });
  try {
    await enqueueEmail(email.id, scheduledAt);
  } catch (error) {
    await prisma.scheduledEmail.update({
      where: { id: email.id },
      data: {
        status: EmailStatus.FAILED,
        failedAt: new Date(),
        lastError: error instanceof Error ? error.message : "Queue retry registration failed"
      }
    });
    throw new HttpError(503, "Could not enqueue email retry");
  }
  return { id: email.id, status: EmailStatus.SCHEDULED, scheduledAt };
}
