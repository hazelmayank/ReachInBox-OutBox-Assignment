import { randomBytes } from "node:crypto";
import { Router } from "express";
import { env } from "../../config/env.js";
import { HttpError } from "../../common/http-error.js";
import { signSession, signShortState, verifyToken } from "../../lib/jwt.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { encrypt } from "../../lib/crypto.js";

interface GoogleTokenResponse { access_token?: string; error?: string }
interface GoogleProfile { sub: string; email: string; name?: string; picture?: string; email_verified?: boolean }

export const authRouter = Router();

authRouter.get("/google", (_req, res) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new HttpError(503, "Google OAuth is not configured");
  const nonce = randomBytes(16).toString("hex");
  const state = signShortState({ sub: nonce, email: "oauth", purpose: "google-oauth" });
  res.cookie("google_oauth_nonce", nonce, {
    httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax", maxAge: 10 * 60 * 1000
  });
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account"
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

authRouter.get("/google/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!code || !state) throw new HttpError(400, "Missing OAuth code or state");
  const statePayload = verifyToken(state);
  if (statePayload.purpose !== "google-oauth" || statePayload.sub !== req.cookies?.google_oauth_nonce) {
    throw new HttpError(400, "Invalid OAuth state");
  }
  res.clearCookie("google_oauth_nonce", { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax" });

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      grant_type: "authorization_code"
    })
  });
  const token = await tokenResponse.json() as GoogleTokenResponse;
  if (!tokenResponse.ok || !token.access_token) throw new HttpError(401, "Google token exchange failed", token.error);

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` }
  });
  const profile = await profileResponse.json() as GoogleProfile;
  if (!profileResponse.ok || !profile.email || !profile.sub || profile.email_verified === false) {
    throw new HttpError(401, "Could not verify Google account");
  }

  const user = await prisma.user.upsert({
    where: { googleId: profile.sub },
    update: { email: profile.email.toLowerCase(), name: profile.name ?? profile.email, avatarUrl: profile.picture ?? null },
    create: { googleId: profile.sub, email: profile.email.toLowerCase(), name: profile.name ?? profile.email, avatarUrl: profile.picture ?? null }
  });
  if (env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM_EMAIL) {
    await prisma.$transaction(async (tx) => {
      await tx.senderAccount.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      await tx.senderAccount.upsert({
        where: { userId_email: { userId: user.id, email: env.SMTP_FROM_EMAIL.toLowerCase() } },
        create: {
          userId: user.id,
          name: env.SMTP_FROM_NAME,
          email: env.SMTP_FROM_EMAIL.toLowerCase(),
          smtpHost: env.SMTP_HOST,
          smtpPort: env.SMTP_PORT,
          smtpSecure: env.SMTP_SECURE,
          smtpUser: env.SMTP_USER,
          encryptedSmtpPassword: encrypt(env.SMTP_PASS),
          isDefault: true
        },
        update: {
          name: env.SMTP_FROM_NAME,
          smtpHost: env.SMTP_HOST,
          smtpPort: env.SMTP_PORT,
          smtpSecure: env.SMTP_SECURE,
          smtpUser: env.SMTP_USER,
          encryptedSmtpPassword: encrypt(env.SMTP_PASS),
          isDefault: true,
          isActive: true
        }
      });
    });
  }
  const session = signSession({ sub: user.id, email: user.email, purpose: "session" });
  res.cookie("session", session, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  res.redirect(`${env.FRONTEND_URL}/dashboard`);
});

authRouter.get("/me", requireAuth, (req, res) => {
  const { id, email, name, avatarUrl } = req.user!;
  res.json({ data: { id, email, name, avatarUrl } });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("session", { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax" });
  res.status(204).send();
});
