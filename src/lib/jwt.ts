import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import type { JwtUser } from "../types/domain.js";

const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as NonNullable<SignOptions["expiresIn"]> };

export const signSession = (payload: JwtUser) => jwt.sign(payload, env.JWT_SECRET, options);
export const signShortState = (payload: JwtUser) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: "10m" });
export const verifyToken = (token: string) => jwt.verify(token, env.JWT_SECRET) as JwtUser;
