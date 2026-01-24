import mongoose, { Schema, Document } from "mongoose";

export type StockMovementType = "IN" | "OUT";
export type StockMovementSource = "SALE" | "PURCHASE" | "ADJUST";

export interface IStockMovement extends Document {
  productId: mongoose.Types.ObjectId;
  type: StockMovementType;
  quantity: number;
  source: StockMovementSource;
  note?: string | null;
  createdAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Product",
    },
    type: {
      type: String,
      enum: ["IN", "OUT"],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    source: {
      type: String,
      enum: ["SALE", "PURCHASE", "ADJUST"],
      required: true,
    },
    note: {
      type: String,
      default: null,
      maxlength: 500,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

StockMovementSchema.index({ productId: 1, createdAt: -1 });

export const StockMovement = mongoose.model<IStockMovement>(
  "StockMovement",
  StockMovementSchema
);

