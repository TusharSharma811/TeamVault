import mongoose, { Schema } from "mongoose";

export interface IShareLink extends mongoose.Document {
  file: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date; 
  downloadCount: number;
}

const ShareLinkSchema = new Schema<IShareLink>(
  {
    file: { type: Schema.Types.ObjectId, ref: "FileObject", required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    downloadCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ShareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ShareLink = mongoose.model<IShareLink>(
  "ShareLink",
  ShareLinkSchema
);
