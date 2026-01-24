import mongoose, { Schema, Document } from "mongoose";

export interface ISale extends Document {
  userId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId | null;
  /**
   * ราคาก่อน VAT (subtotal)
   * optional/backward-compatible: ข้อมูลเก่าจะไม่มี field นี้
   */
  subtotal?: number;
  totalAmount: number;
  /**
   * VAT rate (อัตรา) เช่น:
   * - 0    = ไม่คิด VAT
   * - 0.07 = คิด VAT 7%
   *
   * optional/backward-compatible: ข้อมูลเก่าจะไม่มี field นี้
   */
  vatRate?: number;
  /**
   * VAT amount (จำนวนเงินภาษี) หน่วยบาท
   * optional/backward-compatible: ข้อมูลเก่าจะไม่มี field นี้
   */
  vatAmount?: number;
  /**
   * ยอดรวมหลัง VAT (totalWithVat)
   * optional/backward-compatible: ข้อมูลเก่าจะไม่มี field นี้
   */
  totalWithVat?: number;
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
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    vatRate: {
      type: Number,
      default: 0, // 0 = ไม่คิด VAT, 0.07 = คิด 7%
      min: 0,
    },
    vatAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalWithVat: {
      type: Number,
      default: 0,
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
