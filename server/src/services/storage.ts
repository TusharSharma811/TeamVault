import { StorageConnection } from "../models/StorageConnection.js";
import { decryptJSON } from "../utils/crypto.js";
import { makeS3 } from "./s3.js";
import { makeGCS } from "./gcs.js";

export async function getStorageClient(connId: string) {
  const conn = await StorageConnection.findById(connId);
  if (!conn) throw new Error("Connection not found");
  const creds = decryptJSON<any>(conn.encryptedCredentials);
  if (conn.provider === "aws-s3") {
    return {
      provider: "aws-s3" as const,
      conn,
      client: makeS3({
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        region: conn.region!,
      }),
    };
  } else {
    return { provider: "gcs" as const, conn, client: makeGCS(creds) };
  }
}
