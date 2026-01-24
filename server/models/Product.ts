import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  barcode?: string | null;
  price: number;
  stock: number;
  /**
   * Reorder point (ขั้นต่ำที่ควรแจ้งเตือน)
   * Kept alongside `minStock` for backward compatibility with older data/UI.
   */
  reorderPoint: number;
  /**
   * Legacy field used by older code. Prefer `reorderPoint`.
   */
  minStock: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
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
    barcode: {
      type: String,
      default: null,
      required: false,
      maxlength: 100,
      index: true,
      sparse: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
    },
    reorderPoint: {
      type: Number,
      default: 5,
      required: true,
      min: 0,
    },
    minStock: {
      type: Number,
      default: 5,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Product = mongoose.model<IProduct>("Product", ProductSchema);
