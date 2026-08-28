import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ELASTICSEARCH_URL: z.string().url().default("http://localhost:9200"),
  ELASTICSEARCH_ENABLED: booleanFromString.default("true"),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("7d"),
  INTEGRATION_ENCRYPTION_KEY: z.string().min(32),
  COOKIE_SECURE: booleanFromString,
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  GOOGLE_CALLBACK_URL: z.string().url().default("http://localhost:4000/api/v1/auth/google/callback"),
  SLACK_CLIENT_ID: z.string().default(""),
  SLACK_CLIENT_SECRET: z.string().default(""),
  SLACK_REDIRECT_URI: z.string().url().default("http://localhost:4000/api/v1/integrations/slack/callback"),
  SLACK_SCOPES: z.string().default("chat:write,incoming-webhook"),
  SLACK_DEFAULT_CHANNEL_ID: z.string().default(""),
  SMTP_HOST: z.string().default("smtp.ethereal.email"),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanFromString,
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM_EMAIL: z.string().default(""),
  SMTP_FROM_NAME: z.string().default("ReachInbox Demo"),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(100).default(5),
  MIN_SEND_DELAY_MS: z.coerce.number().int().nonnegative().default(2000),
  DEFAULT_MAX_EMAILS_PER_HOUR: z.coerce.number().int().positive().default(200),
  JOB_ATTEMPTS: z.coerce.number().int().positive().default(5),
  JOB_BACKOFF_MS: z.coerce.number().int().positive().default(5000),
  QUEUE_PREFIX: z.string().default("reachinbox"),
  BULL_BOARD_USERNAME: z.string().default("admin"),
  BULL_BOARD_PASSWORD: z.string().min(8).default("change-me"),
  LOG_LEVEL: z.string().default("info")
});

const result = schema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid environment configuration", result.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = result.data;
