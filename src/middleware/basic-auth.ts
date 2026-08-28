import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";

const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const bullBoardAuth: RequestHandler = (req, res, next) => {
  const [scheme, encoded] = (req.headers.authorization ?? "").split(" ");
  const [username = "", password = ""] = encoded ? Buffer.from(encoded, "base64").toString().split(":") : [];
  if (scheme === "Basic" && safeEqual(username, env.BULL_BOARD_USERNAME) && safeEqual(password, env.BULL_BOARD_PASSWORD)) return next();
  res.setHeader("WWW-Authenticate", 'Basic realm="BullMQ Dashboard"');
  res.status(401).send("Authentication required");
};
