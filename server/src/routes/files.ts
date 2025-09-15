import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth, AuthedRequest } from "../middleware/auth.js";
import { getStorageClient } from "../services/storage.js";
import { FileObject } from "../models/FileObject.js";
import { StorageConnection } from "../models/StorageConnection.js";

const upload = multer();
const router = Router();

function canAccess(conn: any, userId: string) {
  return (
    conn.owner.toString() === userId ||
    conn.allowedUsers.map(String).includes(userId)
  );
}

router.post(
  "/upload",
  requireAuth,
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      connectionId: z.string(),
      keyPrefix: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const conn = await StorageConnection.findById(body.connectionId);
    if (!conn) return res.status(404).json({ error: "Connection not found" });
    if (!canAccess(conn, req.user!.id))
      return res.status(403).json({ error: "Forbidden" });
    if (!req.file) return res.status(400).json({ error: "Missing file" });

    const key = `${body.keyPrefix || conn.defaultPrefix || ""}${Date.now()}_${
      req.file.originalname
    }`.replace(/\/+/, "/");
    const { provider, client } = await getStorageClient(conn.id);

    if (provider === "aws-s3") {
      await client.putObject({
        Bucket: conn.bucket,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });
    } else {
      await client.upload({
        bucket: conn.bucket,
        key,
        body: req.file.buffer,
        contentType: req.file.mimetype,
      });
    }

    const f = await FileObject.create({
      key,
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      connection: conn._id,
      owner: req.user!.id,
      allowedUsers: [],
    });
    res.json(f);
  }
);

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const { connectionId } = req.query as any;
  const conn = await StorageConnection.findById(connectionId);
  if (!conn) return res.status(404).json({ error: "Connection not found" });
  if (!canAccess(conn, req.user!.id))
    return res.status(403).json({ error: "Forbidden" });
  const files = await FileObject.find({ connection: conn._id }).sort({
    createdAt: -1,
  });
  res.json(files);
});

router.post("/:id/whitelist", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    add: z.array(z.string()).default([]),
    remove: z.array(z.string()).default([]),
  });
  const body = schema.parse(req.body);
  const f = await FileObject.findById(req.params.id);
  if (!f) return res.status(404).json({ error: "Not found" });
  if (f.owner.toString() !== req.user!.id)
    return res.status(403).json({ error: "Only owner can modify" });
  const set = new Set(f.allowedUsers.map(String));
  body.add.forEach((u) => set.add(u));
  body.remove.forEach((u) => set.delete(u));
  f.allowedUsers = Array.from(set) as any;
  await f.save();
  res.json(f);
});

router.post("/:id/signed-url", requireAuth, async (req: AuthedRequest, res) => {
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
  // access check: owner OR in file whitelist OR in conn whitelist
  const uid = req.user!.id;
  const ok =
    f.owner.toString() === uid ||
    f.allowedUsers.map(String).includes(uid) ||
    conn.owner.toString() === uid ||
    conn.allowedUsers.map(String).includes(uid);
  if (!ok) return res.status(403).json({ error: "Forbidden" });

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
});

export default router;
