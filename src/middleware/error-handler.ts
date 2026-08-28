import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger.js";
import { HttpError } from "../common/http-error.js";

export const notFound: RequestHandler = (req, _res, next) =>
  next(new HttpError(404, `Route ${req.method} ${req.path} not found`));

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  void _next;
  if (error instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.flatten() });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: error.message, details: error.details });
    return;
  }
  logger.error({ err: error }, "Unhandled request error");
  res.status(500).json({ error: "Internal server error" });
};
