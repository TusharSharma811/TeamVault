import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { config } from "../config.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, AuthedRequest } from "../middleware/auth.js";
import { getStorageClient } from "../services/storage.js";
import { FileObject } from "../models/FileObject.js";
import { StorageConnection } from "../models/StorageConnection.js";
import { logger } from "../utils/logger.js";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 500;
const uploadDir =
  config.uploadTmpDir || path.join(os.tmpdir(), "teamvault-uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: MAX_FILES_PER_REQUEST,
  },
});
const router = Router();

function storageKey(
  prefix: string | undefined,
  fallbackPrefix: string | undefined,
  relativePath: string
) {
  const cleanPrefix = (prefix || fallbackPrefix || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  const cleanRelativePath = relativePath
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  const timestamped = `${Date.now()}_${cleanRelativePath || "upload"}`;
  return cleanPrefix ? `${cleanPrefix}/${timestamped}` : timestamped;
}

function parseRelativePaths(raw: unknown, fileCount: number) {
  if (typeof raw !== "string") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .slice(0, fileCount)
    .map((value) => (typeof value === "string" ? value : ""));
}

async function cleanupUploads(files: Express.Multer.File[]) {
  await Promise.allSettled(
    files.map((file) => fs.promises.unlink(file.path).catch(() => undefined))
  );
}

function canAccess(conn: any, userId: string) {
  return (
    conn.owner.toString() === userId ||
    conn.allowedUsers.map(String).includes(userId)
  );
}

function canManageFile(file: any, conn: any, userId: string) {
  return (
    canAccess(conn, userId) &&
    (file.owner.toString() === userId || conn.owner.toString() === userId)
  );
}

function canAccessFile(file: any, conn: any, userId: string) {
  if (!canAccess(conn, userId)) return false;
  return (
    canManageFile(file, conn, userId) ||
    file.allowedUsers.map(String).includes(userId)
  );
}

function workspaceMemberIds(conn: any) {
  return new Set([conn.owner.toString(), ...conn.allowedUsers.map(String)]);
}

router.post(
  "/upload",
  requireAuth,
  upload.array("files", MAX_FILES_PER_REQUEST),
  asyncHandler(async (req: AuthedRequest, res) => {
    const files = (req.files || []) as Express.Multer.File[];
    const schema = z.object({
      connectionId: z.string(),
      keyPrefix: z.string().optional(),
      relativePaths: z.string().optional(),
    });
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(req.body);
    } catch (error) {
      await cleanupUploads(files);
      throw error;
    }
    const conn = await StorageConnection.findById(body.connectionId);
    if (!conn) {
      await cleanupUploads(files);
      return res.status(404).json({ error: "Connection not found" });
    }
    if (!canAccess(conn, req.user!.id)) {
      await cleanupUploads(files);
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!files.length) return res.status(400).json({ error: "Missing files" });

    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalBytes > MAX_UPLOAD_BYTES) {
      await cleanupUploads(files);
      return res.status(413).json({
        error: "Upload limit is 5GB per request",
      });
    }

    const relativePaths = parseRelativePaths(body.relativePaths, files.length);
    if (!relativePaths) {
      await cleanupUploads(files);
      return res.status(400).json({ error: "Invalid folder path metadata" });
    }
    const { provider, client } = await getStorageClient(conn.id);
    const createdFiles = [];

    logger.info("files.upload.started", {
      connectionId: String(conn._id),
      count: files.length,
      owner: req.user!.id,
      requestId: res.locals.requestId,
      totalBytes,
    });

    try {
      for (const [index, file] of files.entries()) {
        const relativePath = relativePaths[index] || file.originalname;
        const key = storageKey(body.keyPrefix, conn.defaultPrefix, relativePath);
        const stream = fs.createReadStream(file.path);

        if (provider === "aws-s3") {
          await client.putObject({
            Bucket: conn.bucket,
            Key: key,
            Body: stream,
            ContentLength: file.size,
            ContentType: file.mimetype,
          });
        } else {
          await client.upload({
            bucket: conn.bucket,
            key,
            body: stream,
            contentType: file.mimetype,
          });
        }

        const saved = await FileObject.create({
          key,
          name: relativePath.split("/").pop() || file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          connection: conn._id,
          owner: req.user!.id,
          allowedUsers: [],
        });
        createdFiles.push(saved);
      }

      logger.info("files.upload.completed", {
        connectionId: String(conn._id),
        count: createdFiles.length,
        owner: req.user!.id,
        requestId: res.locals.requestId,
      });

      res.json(createdFiles);
    } finally {
      await cleanupUploads(files);
    }
  })
);

router.get("/", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const { connectionId } = req.query as any;
  const conn = await StorageConnection.findById(connectionId);
  if (!conn) return res.status(404).json({ error: "Connection not found" });
  if (!canAccess(conn, req.user!.id))
    return res.status(403).json({ error: "Forbidden" });
  const fileFilter =
    conn.owner.toString() === req.user!.id
      ? { connection: conn._id }
      : {
          connection: conn._id,
          $or: [{ owner: req.user!.id }, { allowedUsers: req.user!.id }],
        };
  const files = await FileObject.find(fileFilter).sort({ createdAt: -1 });
  res.json(files);
}));

router.post("/:id/whitelist", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const schema = z.object({
    add: z.array(z.string()).default([]),
    remove: z.array(z.string()).default([]),
  });
  const body = schema.parse(req.body);
  const f = await FileObject.findById(req.params.id);
  if (!f) return res.status(404).json({ error: "Not found" });
  const conn = await StorageConnection.findById(f.connection);
  if (!conn) return res.status(404).json({ error: "Connection missing" });
  if (!canManageFile(f, conn, req.user!.id)) {
    return res.status(403).json({ error: "Only file or workspace owner can modify" });
  }
  const members = workspaceMemberIds(conn);
  const invalidUsers = body.add.filter((userId) => !members.has(userId));
  if (invalidUsers.length) {
    return res.status(400).json({
      error: "Files can only be shared with workspace members",
    });
  }
  const set = new Set(f.allowedUsers.map(String));
  set.delete(String(f.owner));
  body.add.forEach((u) => set.add(u));
  body.remove.forEach((u) => set.delete(u));
  set.delete(String(f.owner));
  f.allowedUsers = Array.from(set) as any;
  await f.save();
  res.json(f);
}));

router.post("/:id/signed-url", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const schema = z.object({
    expiresIn: z
      .number()
      .min(60)
      .max(60 * 60 * 24)
      .default(3600),
  });
  const { expiresIn } = schema.parse(req.body || {});
  const f = await FileObject.findById(req.params.id);
  if (!f) return res.status(404).json({ error: "Not found" });
  const conn = await StorageConnection.findById(f.connection);
  if (!conn) return res.status(404).json({ error: "Connection missing" });
  const uid = req.user!.id;
  if (!canAccessFile(f, conn, uid)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { provider, client } = await getStorageClient(String(conn._id));
  let url = "";
  if (provider === "aws-s3") {
    url = await client.signedGetUrl({
      Bucket: conn.bucket,
      Key: f.key,
      Expires: expiresIn,
    });
  } else {
    url = await client.signedGetUrl({
      bucket: conn.bucket,
      key: f.key,
      expires: expiresIn,
    });
  }
  res.json({ url, expiresIn });
}));

router.delete("/:id", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const f = await FileObject.findById(req.params.id);
  if (!f) return res.status(404).json({ error: "Not found" });
  const conn = await StorageConnection.findById(f.connection);
  if (!conn) return res.status(404).json({ error: "Connection missing" });
  if (!canManageFile(f, conn, req.user!.id)) {
    return res.status(403).json({ error: "Only file or workspace owner can delete" });
  }

  const { provider, client } = await getStorageClient(String(conn._id));
  if (provider === "aws-s3") {
    await client.deleteObject({ Bucket: conn.bucket, Key: f.key });
  } else {
    await client.deleteObject({ bucket: conn.bucket, key: f.key });
  }

  await f.deleteOne();
  res.json({ ok: true });
}));

export default router;
