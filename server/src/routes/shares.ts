import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import { FileObject } from '../models/FileObject.js';
import { ShareLink } from '../models/ShareLink.js';
import { getStorageClient } from '../services/storage.js';
import { StorageConnection } from '../models/StorageConnection.js';


const router = Router();


router.post('/', requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
const schema = z.object({ fileId: z.string(), expiresIn: z.number().min(60).max(60*60*24*7).default(3600) });
const { fileId, expiresIn } = schema.parse(req.body);
const f = await FileObject.findById(fileId);
if (!f) return res.status(404).json({ error: 'File not found' });
const conn = await StorageConnection.findById(f.connection);
if (!conn) return res.status(404).json({ error: 'Connection missing' });
const uid = req.user!.id;
const hasWorkspaceAccess = conn.owner.toString() === uid || conn.allowedUsers.map(String).includes(uid);
const canManage = hasWorkspaceAccess && (f.owner.toString() === uid || conn.owner.toString() === uid);
if (!canManage) return res.status(403).json({ error: 'Only file or workspace owner can create share' });
const token = nanoid(32);
const link = await ShareLink.create({ file: f._id, token, expiresAt: new Date(Date.now() + expiresIn * 1000) });
res.json({ token, expiresAt: link.expiresAt });
}));


// Public download via share token -> redirects to signed URL
router.get('/:token', asyncHandler(async (req, res) => {
const link = await ShareLink.findOne({ token: req.params.token }).populate('file');
if (!link) return res.status(404).json({ error: 'Not found' });
if (link.expiresAt.getTime() <= Date.now()) {
await link.deleteOne();
return res.status(410).json({ error: 'Share link expired' });
}
const f: any = link.file;
const conn = await StorageConnection.findById(f.connection);
if (!conn) return res.status(404).json({ error: 'Connection missing' });
const { provider, client } = await getStorageClient(String(conn._id));
let url = '';
const expiresIn = 300; // short-lived hop link
if (provider === 'aws-s3') {
url = await client.signedGetUrl({ Bucket: conn.bucket, Key: f.key, Expires: expiresIn });
} else {
url = await client.signedGetUrl({ bucket: conn.bucket, key: f.key, expires: expiresIn });
}
link.downloadCount += 1;
await link.save();
res.redirect(url);
}));


export default router;
