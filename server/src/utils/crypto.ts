import crypto from 'crypto';
import { config } from '../config.js';


const KEY = Buffer.from(config.cryptoSecret);


export function encryptJSON(obj: unknown) {
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
const json = Buffer.from(JSON.stringify(obj));
const enc = Buffer.concat([cipher.update(json), cipher.final()]);
const tag = cipher.getAuthTag();
return Buffer.concat([iv, tag, enc]).toString('base64');
}


export function decryptJSON<T = any>(b64: string): T {
const buf = Buffer.from(b64, 'base64');
const iv = buf.subarray(0, 12);
const tag = buf.subarray(12, 28);
const data = buf.subarray(28);
const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
decipher.setAuthTag(tag);
const dec = Buffer.concat([decipher.update(data), decipher.final()]);
return JSON.parse(dec.toString());
}