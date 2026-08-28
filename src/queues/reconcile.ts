import { EmailStatus } from "@prisma/client";
import { logger } from "../config/logger.js";
import { prisma } from "../lib/prisma.js";
import { enqueueEmail } from "./email.queue.js";

export async function reconcileScheduledEmails() {
  let cursor: string | undefined;
  let queued = 0;
  do {
    const emails = await prisma.scheduledEmail.findMany({
      where: { status: { in: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING] } },
      select: { id: true, scheduledAt: true },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });
    await Promise.all(emails.map((email) => enqueueEmail(email.id, email.scheduledAt)));
    queued += emails.length;
    cursor = emails.at(-1)?.id;
    if (emails.length < 500) break;
  } while (cursor);
  logger.info({ queued }, "Scheduled email reconciliation complete");
}
