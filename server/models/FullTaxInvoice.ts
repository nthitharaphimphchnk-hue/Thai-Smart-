import mongoose, { Schema, Document } from "mongoose";

/**
 * Full Tax Invoice Model - สำหรับเก็บใบกำกับภาษีเต็ม
 * ออกได้เฉพาะบิลที่มี VAT (vatRate > 0)
 */
export interface IFullTaxInvoice extends Document {
  userId: mongoose.Types.ObjectId;
  saleId: mongoose.Types.ObjectId; // เชื่อมกับ Sale
  invoiceNumber: string; // เลขที่ใบกำกับภาษี (ต้องไม่ซ้ำ, เรียงลำดับ)
  
  // ข้อมูลผู้ขาย (จาก Settings)
  sellerName: string; // ชื่อร้าน
  sellerAddress: string; // ที่อยู่ร้าน
  sellerTaxId: string; // เลขประจำตัวผู้เสียภาษีผู้ขาย
  
  // ข้อมูลผู้ซื้อ
  buyerName: string; // ชื่อผู้ซื้อ
  buyerAddress: string; // ที่อยู่ผู้ซื้อ
  buyerTaxId?: string | null; // เลขประจำตัวผู้เสียภาษีผู้ซื้อ (optional)
  
  // ข้อมูลภาษี (จาก Sale)
  subtotal: number; // ยอดก่อน VAT
  vatAmount: number; // VAT 7%
  totalWithVat: number; // ยอดรวม VAT
  
  // วันที่ออกเอกสาร
  issuedDate: Date;
  
  // สถานะเอกสาร
  status: "issued" | "cancelled"; // issued = ออกแล้ว, cancelled = ยกเลิก
  
  createdAt: Date;
  updatedAt: Date;
}

const FullTaxInvoiceSchema = new Schema<IFullTaxInvoice>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
      index: true,
    },
    saleId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Sale",
      unique: true, // 1 Sale = 1 Full Tax Invoice (ถ้ามี)
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true, // เลขที่ใบกำกับภาษีต้องไม่ซ้ำ
      index: true,
    },
    sellerName: {
      type: String,
      required: true,
    },
    sellerAddress: {
      type: String,
      required: true,
    },
    sellerTaxId: {
      type: String,
      required: true,
    },
    buyerName: {
      type: String,
      required: true,
    },
    buyerAddress: {
      type: String,
      required: true,
    },
    buyerTaxId: {
      type: String,
      required: false,
      default: null,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    vatAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalWithVat: {
      type: Number,
      required: true,
      min: 0,
    },
    issuedDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["issued", "cancelled"],
      default: "issued",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index สำหรับค้นหาเร็ว
FullTaxInvoiceSchema.index({ userId: 1, invoiceNumber: 1 });
FullTaxInvoiceSchema.index({ userId: 1, saleId: 1 });

export const FullTaxInvoice = mongoose.model<IFullTaxInvoice>("FullTaxInvoice", FullTaxInvoiceSchema);
