import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends mongoose.Document {
  email: string;
  name: string;
  passwordHash: string;
  comparePassword(pw: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, unique: true, required: true, index: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

UserSchema.methods.comparePassword = async function (pw: string) {
  return bcrypt.compare(pw, this.passwordHash);
};

export const User = mongoose.model<IUser>("User", UserSchema);
