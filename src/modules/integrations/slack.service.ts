import { decrypt } from "../../lib/crypto.js";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../config/logger.js";

export type SlackSendResult =
  | { sent: true }
  | { sent: false; reason: "not_connected" | "slack_api_error"; error?: string };

export async function sendSlackMessage(userId: string, text: string): Promise<SlackSendResult> {
  const connection = await prisma.slackConnection.findUnique({ where: { userId } });
  if (!connection) return { sent: false, reason: "not_connected" };
  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        authorization: `Bearer ${decrypt(connection.encryptedAccessToken)}`,
        "content-type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({ channel: connection.channelId, text })
    });
    const result = await response.json() as { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) {
      logger.warn({ userId, error: result.error }, "Slack notification failed");
      return { sent: false, reason: "slack_api_error", ...(result.error ? { error: result.error } : {}) };
    }
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Slack network error";
    logger.warn({ userId, err: error }, "Slack notification request failed");
    return { sent: false, reason: "slack_api_error", error: message };
  }
}

export async function notifyRateLimitHit(userId: string, senderEmail: string, limit: number, nextWindow: Date) {
  return sendSlackMessage(
    userId,
    `ReachInbox rate limit reached for ${senderEmail}. Limit: ${limit}/hour. Remaining emails are delayed until ${nextWindow.toISOString()}.`
  );
}
