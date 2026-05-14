import { Router } from 'express';
import { z } from 'zod';
import { encryptJSON } from '../utils/crypto.js';
import { StorageConnection } from '../models/StorageConnection.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';


const router = Router();


router.post('/connections', requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
const schema = z.discriminatedUnion('provider', [
z.object({ provider: z.literal('aws-s3'), name: z.string(), bucket: z.string(), region: z.string(), accessKeyId: z.string(), secretAccessKey: z.string(), defaultPrefix: z.string().optional(), allowedUsers: z.array(z.string()).optional() }),
z.object({ provider: z.literal('gcs'), name: z.string(), bucket: z.string(), serviceAccountJSON: z.any(), defaultPrefix: z.string().optional(), allowedUsers: z.array(z.string()).optional() }),
]);
const body = schema.parse(req.body);


let encryptedCredentials = '';
if (body.provider === 'aws-s3') {
encryptedCredentials = encryptJSON({ accessKeyId: body.accessKeyId, secretAccessKey: body.secretAccessKey });
} else {
encryptedCredentials = encryptJSON(body.serviceAccountJSON);
}


const conn = await StorageConnection.create({
owner: req.user!.id,
provider: body.provider,
name: body.name,
bucket: body.bucket,
region: body.provider === 'aws-s3' ? body.region : undefined,
encryptedCredentials,
allowedUsers: body.allowedUsers || [],
defaultPrefix: body.defaultPrefix,
});


res.json(conn);
}));


router.get('/connections', requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
const conns = await StorageConnection.find({ $or: [ { owner: req.user!.id }, { allowedUsers: req.user!.id } ] });
res.json(conns);
}));


router.post('/connections/:id/whitelist', requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
const schema = z.object({ add: z.array(z.string()).default([]), remove: z.array(z.string()).default([]) });
const body = schema.parse(req.body);
const conn = await StorageConnection.findById(req.params.id);
if (!conn) return res.status(404).json({ error: 'Not found' });
if (conn.owner.toString() !== req.user!.id) return res.status(403).json({ error: 'Only owner can modify' });
const set = new Set(conn.allowedUsers.map(String));
body.add.forEach(u => set.add(u));
body.remove.forEach(u => set.delete(u));
conn.allowedUsers = Array.from(set) as any;
await conn.save();
res.json(conn);
}));


export default router;
