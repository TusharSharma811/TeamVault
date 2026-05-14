import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { logger } from "../utils/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  const requestId = randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  logger.info("request.started", {
    method: req.method,
    path: req.originalUrl,
    requestId,
  });

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level]("request.finished", {
      durationMs,
      method: req.method,
      path: req.originalUrl,
      requestId,
      statusCode: res.statusCode,
    });
  });

  next();
}
