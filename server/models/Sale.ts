import mongoose, { Schema, Document } from "mongoose";

export interface ISale extends Document {
  userId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId | null;
  totalAmount: number;
  paymentType: "cash" | "credit";
  createdAt: Date;
}

const SaleSchema = new Schema<ISale>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    customerId: {
      type: Schema.Types.ObjectId,
      default: null,
      ref: "Customer",
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentType: {
      type: String,
      enum: ["cash", "credit"],
      default: "cash",
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const Sale = mongoose.model<ISale>("Sale", SaleSchema);
