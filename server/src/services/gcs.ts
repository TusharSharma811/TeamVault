import { Storage } from "@google-cloud/storage";

export function makeGCS(credentials: any) {
  const storage = new Storage({ credentials });
  return {
    async upload(params: {
      bucket: string;
      key: string;
      body: Buffer;
      contentType?: string;
    }) {
      const bucket = storage.bucket(params.bucket);
      const file = bucket.file(params.key);
      await file.save(params.body, { contentType: params.contentType });
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
    client: storage,
  };
}
