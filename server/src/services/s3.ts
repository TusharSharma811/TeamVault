import {
  DeleteObjectCommand,
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

export function makeS3(credentials: {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}) {
  const s3 = new S3Client({
    region: credentials.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });

  return {
    async putObject(params: {
      Bucket: string;
      Key: string;
      Body: Buffer | Uint8Array | Blob | Readable | string;
      ContentLength?: number;
      ContentType?: string;
    }) {
      await s3.send(new PutObjectCommand(params));
    },
    async signedGetUrl(params: {
      Bucket: string;
      Key: string;
      Expires: number;
    }) {
      return getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: params.Bucket, Key: params.Key }),
        { expiresIn: params.Expires }
      );
    },
    async deleteObject(params: { Bucket: string; Key: string }) {
      await s3.send(new DeleteObjectCommand(params));
    },
    client: s3,
  };
}
