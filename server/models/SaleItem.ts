import mongoose, { Schema, Document } from "mongoose";

export interface ISaleItem extends Document {
  saleId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

const SaleItemSchema = new Schema<ISaleItem>(
  {
    saleId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Sale",
    },
    productId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Product",
    },
    productName: {
      type: String,
      required: true,
      maxlength: 255,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: false,
  }
);

export const SaleItem = mongoose.model<ISaleItem>("SaleItem", SaleItemSchema);
