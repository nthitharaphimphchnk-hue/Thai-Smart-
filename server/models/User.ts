import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  openId?: string | null; // Optional for email/password users
  email?: string | null;
  password?: string | null; // Hashed password for email/password login
  name?: string | null;
  loginMethod?: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

const UserSchema = new Schema<IUser>(
  {
    openId: {
      type: String,
      required: false,
      unique: true,
      sparse: true, // Allow null for email/password users
      maxlength: 64,
    },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true, // Allow null for OAuth users
      maxlength: 320,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: false,
      select: false, // Don't return password by default
    },
    name: {
      type: String,
      default: null,
    },
    loginMethod: {
      type: String,
      default: null,
      maxlength: 64,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      required: true,
    },
    lastSignedIn: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for email lookup
UserSchema.index({ email: 1 });

export const User = mongoose.model<IUser>("User", UserSchema);
