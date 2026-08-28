import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { senderRouter } from "./modules/senders/sender.routes.js";
import { emailRouter } from "./modules/emails/email.routes.js";
import { searchRouter } from "./modules/emails/search.routes.js";
import { slackRouter } from "./modules/integrations/slack.routes.js";
import { emailQueue } from "./queues/email.queue.js";
import { bullBoardAuth } from "./middleware/basic-auth.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";

export const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }));

app.get("/health", async (_req, res) => {
  const [database, redisStatus] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => "up").catch(() => "down"),
    redis.ping().then(() => "up").catch(() => "down")
  ]);
  res.status(database === "up" && redisStatus === "up" ? 200 : 503).json({ status: "ok", dependencies: { database, redis: redisStatus } });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/senders", senderRouter);
app.use("/api/v1/emails", emailRouter);
app.use("/api/v1/search", searchRouter);
app.use("/api/v1/integrations/slack", slackRouter);

const boardAdapter = new ExpressAdapter();
boardAdapter.setBasePath("/admin/queues");
createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter: boardAdapter });
app.use("/admin/queues", bullBoardAuth, boardAdapter.getRouter());

app.use(notFound);
app.use(errorHandler);

// "data":[{"id":"cmtc3n19n0002udlsbbjicknm","name":"ReachInbox Demo","email":"christy.mertz43@ethereal.email","smtpHost":"smtp.ethereal.email","smtpPort":587,"smtpSecure":false}]}