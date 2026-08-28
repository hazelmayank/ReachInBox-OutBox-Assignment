import { Router } from "express";
import { z } from "zod";
import { searchEmailIds } from "../../lib/elasticsearch.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

const searchSchema = z.object({ q: z.string().trim().min(1).max(200), limit: z.coerce.number().int().positive().max(100).default(20) });
export const searchRouter = Router();
searchRouter.use(requireAuth);

searchRouter.get("/", async (req, res) => {
  const { q, limit } = searchSchema.parse(req.query);
  const ids = await searchEmailIds(req.user!.id, q, limit);
  const data = await prisma.scheduledEmail.findMany({
    where: ids ? { id: { in: ids }, campaign: { userId: req.user!.id } } : {
      campaign: { userId: req.user!.id },
      OR: [{ recipient: { contains: q, mode: "insensitive" } }, { campaign: { subject: { contains: q, mode: "insensitive" } } }]
    },
    include: { campaign: { select: { subject: true, sender: { select: { name: true, email: true } } } } },
    take: limit
  });
  res.json({ data, searchEngine: ids ? "elasticsearch" : "postgres-fallback" });
});
