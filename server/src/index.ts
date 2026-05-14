import express from "express";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import { connectDB } from "./db.js";
import { config } from "./config.js";
import { requestLogger } from "./middleware/requestLogger.js";
import authRoutes from "./routes/auth.js";
import storageRoutes from "./routes/storage.js";
import fileRoutes from "./routes/files.js";
import shareRoutes from "./routes/shares.js";
import { logger } from "./utils/logger.js";

const app = express();
const corsOrigin =
  config.corsOrigin === "*"
    ? true
    : config.corsOrigin.split(",").map((origin) => origin.trim());

app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(requestLogger);
app.use(express.json({ limit: "10mb" }));
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

app.get("/health", (_, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/storage", storageRoutes);
app.use("/files", fileRoutes);
app.use("/shares", shareRoutes);

app.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: err.flatten(),
        requestId: res.locals.requestId,
      });
    }

    if (err instanceof multer.MulterError) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Upload limit is 5GB per file"
          : err.message;
      logger.warn("request.upload.failed", {
        code: err.code,
        message: err.message,
        requestId: res.locals.requestId,
        statusCode: status,
      });
      return res.status(status).json({
        error: message,
        requestId: res.locals.requestId,
      });
    }

    const maybeStatus =
      typeof err === "object" && err !== null && "status" in err
        ? Number((err as { status?: number }).status)
        : undefined;
    const status = maybeStatus && maybeStatus >= 400 ? maybeStatus : 500;
    const message =
      status === 500
        ? "Internal server error"
        : err instanceof Error
          ? err.message
          : "Request failed";

    const log = status >= 500 ? logger.error : logger.warn;
    log("request.failed", {
      error: err,
      requestId: res.locals.requestId,
      statusCode: status,
    });
    res.status(status).json({ error: message, requestId: res.locals.requestId });
  }
);

connectDB().then(() => {
  app.listen(config.port, () =>
    logger.info("server.started", { port: config.port })
  );
});
