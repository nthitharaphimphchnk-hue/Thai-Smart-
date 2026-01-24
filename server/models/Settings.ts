import mongoose, { Schema, Document } from "mongoose";

/**
 * Settings Model - สำหรับเก็บ global system settings
 * ใช้ singleton pattern (มีแค่ 1 record ใน DB)
 */
export interface ISettings extends Document {
  vatEnabled: boolean;
  // ข้อมูลผู้ขาย (สำหรับใบกำกับภาษีเต็ม)
  sellerName?: string; // ชื่อร้าน
  sellerAddress?: string; // ที่อยู่ร้าน
  sellerTaxId?: string; // เลขประจำตัวผู้เสียภาษีผู้ขาย
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    vatEnabled: {
      type: Boolean,
      default: false,
      required: true,
    },
    sellerName: {
      type: String,
      required: false,
      default: "",
    },
    sellerAddress: {
      type: String,
      required: false,
      default: "",
    },
    sellerTaxId: {
      type: String,
      required: false,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists
SettingsSchema.index({}, { unique: true });

export const Settings = mongoose.model<ISettings>("Settings", SettingsSchema);
