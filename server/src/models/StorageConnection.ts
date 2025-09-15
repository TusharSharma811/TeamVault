import mongoose, { Schema } from "mongoose";

export type Provider = "aws-s3" | "gcs";

export interface IStorageConnection extends mongoose.Document {
  owner: mongoose.Types.ObjectId;
  provider: Provider;
  name: string;
  bucket: string;
  region?: string;
  encryptedCredentials: string; 
  allowedUsers: mongoose.Types.ObjectId[]; // whitelist of users
  defaultPrefix?: string;
}

const StorageConnectionSchema = new Schema<IStorageConnection>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, enum: ["aws-s3", "gcs"], required: true },
    name: { type: String, required: true },
    bucket: { type: String, required: true },
    region: { type: String },
    encryptedCredentials: { type: String, required: true },
    allowedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    defaultPrefix: { type: String },
  },
  { timestamps: true }
);

export const StorageConnection = mongoose.model<IStorageConnection>(
  "StorageConnection",
  StorageConnectionSchema
);
