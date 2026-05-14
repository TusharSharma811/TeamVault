import { Storage } from "@google-cloud/storage";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

export function makeGCS(credentials: any) {
  const storage = new Storage({ credentials });
  return {
    async upload(params: {
      bucket: string;
      key: string;
      body: Buffer | Readable;
      contentType?: string;
    }) {
      const bucket = storage.bucket(params.bucket);
      const file = bucket.file(params.key);
      if (Buffer.isBuffer(params.body)) {
      await file.save(params.body, { contentType: params.contentType });
        return;
      }

      await pipeline(
        params.body,
        file.createWriteStream({ contentType: params.contentType })
      );
    },
    async signedGetUrl(params: {
      bucket: string;
      key: string;
      expires: number;
    }) {
      const bucket = storage.bucket(params.bucket);
      const file = bucket.file(params.key);
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + params.expires * 1000,
      });
      return url;
    },
    async deleteObject(params: { bucket: string; key: string }) {
      const bucket = storage.bucket(params.bucket);
      const file = bucket.file(params.key);
      await file.delete({ ignoreNotFound: true });
    },
    client: storage,
  };
}
