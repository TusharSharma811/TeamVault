import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { connectDB } from "./db.js";
import { config } from "./config.js";
import authRoutes from "./routes/auth.js";
import storageRoutes from "./routes/storage.js";
import fileRoutes from "./routes/files.js";
import shareRoutes from "./routes/shares.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

app.get("/health", (_, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/storage", storageRoutes);
app.use("/files", fileRoutes);
app.use("/shares", shareRoutes);

connectDB().then(() => {
  app.listen(config.port, () => console.log("API on :" + config.port));
});
