import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { encrypt } from "../../lib/crypto.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

const senderSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email(),
  smtpHost: z.string().trim().min(1).default(env.SMTP_HOST),
  smtpPort: z.number().int().positive().default(env.SMTP_PORT),
  smtpSecure: z.boolean().default(env.SMTP_SECURE),
  smtpUser: z.string().trim().min(1),
  smtpPassword: z.string().min(1),
  makeDefault: z.boolean().default(false)
});

export const senderRouter = Router();
senderRouter.use(requireAuth);

senderRouter.get("/", async (req, res) => {
  const senders = await prisma.senderAccount.findMany({
    where: { userId: req.user!.id },
    select: { id: true, name: true, email: true, smtpHost: true, smtpPort: true, smtpSecure: true, isDefault: true, isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
  });
  res.json({ data: senders });
});

senderRouter.post("/", async (req, res) => {
  const input = senderSchema.parse(req.body);
  const existingCount = await prisma.senderAccount.count({ where: { userId: req.user!.id } });
  const makeDefault = input.makeDefault || existingCount === 0;
  const sender = await prisma.$transaction(async (tx) => {
    if (makeDefault) await tx.senderAccount.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
    return tx.senderAccount.create({
      data: {
        userId: req.user!.id,
        name: input.name,
        email: input.email.toLowerCase(),
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpSecure: input.smtpSecure,
        smtpUser: input.smtpUser,
        encryptedSmtpPassword: encrypt(input.smtpPassword),
        isDefault: makeDefault
      },
      select: { id: true, name: true, email: true, smtpHost: true, smtpPort: true, smtpSecure: true, isDefault: true, isActive: true }
    });
  });
  res.status(201).json({ data: sender });
});

senderRouter.patch("/:id/default", async (req, res) => {
  const sender = await prisma.senderAccount.findFirst({ where: { id: req.params.id, userId: req.user!.id, isActive: true } });
  if (!sender) {
    res.status(404).json({ error: "Active sender account not found" });
    return;
  }
  await prisma.$transaction([
    prisma.senderAccount.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } }),
    prisma.senderAccount.update({ where: { id: sender.id }, data: { isDefault: true } })
  ]);
  res.json({ data: { id: sender.id, isDefault: true } });
});

senderRouter.patch("/:id/deactivate", async (req, res) => {
  const sender = await prisma.senderAccount.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!sender) {
    res.status(404).json({ error: "Sender account not found" });
    return;
  }
  await prisma.senderAccount.update({ where: { id: sender.id }, data: { isActive: false, isDefault: false } });
  res.status(204).send();
});
