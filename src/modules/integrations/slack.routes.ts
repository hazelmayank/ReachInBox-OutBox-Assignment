import { Router } from "express";
import { env } from "../../config/env.js";
import { encrypt } from "../../lib/crypto.js";
import { signShortState, verifyToken } from "../../lib/jwt.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { HttpError } from "../../common/http-error.js";
import { sendSlackMessage } from "./slack.service.js";

interface SlackOAuthResponse {
  ok?: boolean; access_token?: string; team?: { id?: string; name?: string };
  bot_user_id?: string; incoming_webhook?: { channel_id?: string; channel?: string }; error?: string;
}

export const slackRouter = Router();

slackRouter.get("/connect", requireAuth, (req, res) => {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) throw new HttpError(503, "Slack OAuth is not configured");
  const state = signShortState({ sub: req.user!.id, email: req.user!.email, purpose: "slack-oauth" });
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: env.SLACK_SCOPES,
    redirect_uri: env.SLACK_REDIRECT_URI,
    state
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
});

slackRouter.get("/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!code || !state) throw new HttpError(400, "Missing Slack OAuth code or state");
  const statePayload = verifyToken(state);
  if (statePayload.purpose !== "slack-oauth") throw new HttpError(400, "Invalid Slack OAuth state");

  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      redirect_uri: env.SLACK_REDIRECT_URI
    })
  });
  const result = await response.json() as SlackOAuthResponse;
  const channelId = result.incoming_webhook?.channel_id ?? env.SLACK_DEFAULT_CHANNEL_ID;
  if (!result.ok || !result.access_token || !result.team?.id || !channelId) {
    throw new HttpError(400, "Slack connection failed. Select a channel or configure SLACK_DEFAULT_CHANNEL_ID.", result.error);
  }
  await prisma.slackConnection.upsert({
    where: { userId: statePayload.sub },
    create: {
      userId: statePayload.sub,
      teamId: result.team.id,
      teamName: result.team.name ?? null,
      botUserId: result.bot_user_id ?? null,
      channelId,
      channelName: result.incoming_webhook?.channel ?? null,
      encryptedAccessToken: encrypt(result.access_token)
    },
    update: {
      teamId: result.team.id,
      teamName: result.team.name ?? null,
      botUserId: result.bot_user_id ?? null,
      channelId,
      channelName: result.incoming_webhook?.channel ?? null,
      encryptedAccessToken: encrypt(result.access_token)
    }
  });
  res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
});

slackRouter.get("/status", requireAuth, async (req, res) => {
  const connection = await prisma.slackConnection.findUnique({
    where: { userId: req.user!.id }, select: { teamName: true, channelName: true, channelId: true }
  });
  res.json({ data: { connected: Boolean(connection), ...connection } });
});

slackRouter.delete("/disconnect", requireAuth, async (req, res) => {
  await prisma.slackConnection.deleteMany({ where: { userId: req.user!.id } });
  res.status(204).send();
});

slackRouter.post("/test", requireAuth, async (req, res) => {
  const result = await sendSlackMessage(
    req.user!.id,
    "ReachInbox Slack connection is working. Rate-limit alerts will appear in this channel."
  );
  if (!result.sent && result.reason === "not_connected") throw new HttpError(409, "Slack is not connected");
  if (!result.sent) throw new HttpError(502, "Slack rejected the test message", result.error);
  res.json({ data: { sent: true } });
});
