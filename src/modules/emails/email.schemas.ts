import { z } from "zod";

export const scheduleCampaignSchema = z.object({
  senderId: z.string().cuid(),
  recipients: z.array(z.string().trim().email().transform((v) => v.toLowerCase())).min(1).max(10_000),
  subject: z.string().trim().min(1).max(998),
  bodyHtml: z.string().min(1).max(500_000),
  startTime: z.coerce.date().refine((date) => date.getTime() > Date.now() - 5_000, "Start time must be in the future"),
  delayMs: z.number().int().nonnegative().max(3_600_000),
  hourlyLimit: z.number().int().positive().max(100_000)
});

export const listEmailsSchema = z.object({
  status: z.enum(["scheduled", "sent", "failed"]).default("scheduled"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(200).optional()
});
