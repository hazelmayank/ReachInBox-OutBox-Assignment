import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { listEmailsSchema, scheduleCampaignSchema } from "./email.schemas.js";
import { listEmails, retryFailedEmail, scheduleCampaign } from "./email.service.js";

export const emailRouter = Router();
emailRouter.use(requireAuth);

emailRouter.post("/campaigns", async (req, res) => {
  const input = scheduleCampaignSchema.parse(req.body);
  const campaign = await scheduleCampaign(req.user!.id, input);
  res.status(201).json({ data: campaign });
});

emailRouter.get("/", async (req, res) => {
  const query = listEmailsSchema.parse(req.query);
  res.json(await listEmails(req.user!.id, query));
});

emailRouter.post("/:id/retry", async (req, res) => {
  const result = await retryFailedEmail(req.user!.id, req.params.id);
  res.json({ data: result });
});
