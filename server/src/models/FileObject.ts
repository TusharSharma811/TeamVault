import mongoose, { Schema } from "mongoose";

export interface IFileObject extends mongoose.Document {
  key: string; // path within bucket
  name: string; // display name
  size: number;
  mimetype: string;
  connection: mongoose.Types.ObjectId; // StorageConnection
  owner: mongoose.Types.ObjectId; // User who uploaded/registered
  allowedUsers: mongoose.Types.ObjectId[]; // optional per-file overrides
}

const FileObjectSchema = new Schema<IFileObject>(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    mimetype: { type: String, required: true },
    connection: {
      type: Schema.Types.ObjectId,
      ref: "StorageConnection",
      required: true,
    },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    allowedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export const FileObject = mongoose.model<IFileObject>(
  "FileObject",
  FileObjectSchema
);
