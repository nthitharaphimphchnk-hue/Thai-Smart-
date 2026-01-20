import mongoose, { Schema, Document } from "mongoose";

export interface ICustomer extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  phone?: string | null;
  totalDebt: number;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    name: {
      type: String,
      required: true,
      maxlength: 255,
    },
    phone: {
      type: String,
      default: null,
      maxlength: 20,
    },
    totalDebt: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Customer = mongoose.model<ICustomer>("Customer", CustomerSchema);
