import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { verifyToken } from "../lib/jwt.js";
import { HttpError } from "../common/http-error.js";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const headerToken = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;
  const token = req.cookies?.session as string | undefined ?? headerToken;
  if (!token) throw new HttpError(401, "Authentication required");

  try {
    const payload = verifyToken(token);
    if (payload.purpose && payload.purpose !== "session") throw new Error("Wrong token purpose");
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new Error("User no longer exists");
    req.user = user;
    next();
  } catch {
    throw new HttpError(401, "Invalid or expired session");
  }
};
