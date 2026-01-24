import mongoose, { Schema, Document } from "mongoose";

/**
 * Shift Model - สำหรับจัดการการเปิด/ปิดรอบกะ (Shift Closing)
 * 
 * รองรับการทำงานของร้านค้าที่ต้องปิดกะทุกวัน โดยเก็บข้อมูล:
 * - เงินสดเปิดกะ / ปิดกะ
 * - ยอดขายเงินสด / เครดิต
 * - ผลต่างเงินสด (เพื่อตรวจสอบความถูกต้อง)
 */
export interface IShift extends Document {
  userId: mongoose.Types.ObjectId;
  /**
   * เลขกะ - เริ่มจาก 1 ในแต่ละวัน
   * เช่น วันเดียวกันอาจมีกะเช้า (1), กะบ่าย (2), กะดึก (3)
   */
  shiftNumber: number;
  /**
   * วันที่ของกะ - normalize เป็นวัน (00:00:00)
   * ใช้สำหรับกรองและค้นหากะตามวันที่
   */
  shiftDate: Date;
  /**
   * เวลาเปิดกะ - timestamp จริงที่เปิดกะ
   */
  startTime: Date;
  /**
   * เวลาปิดกะ - timestamp จริงที่ปิดกะ (null = ยังไม่ปิด)
   */
  endTime?: Date | null;
  /**
   * เงินสดเปิดกะ - จำนวนเงินสดที่เริ่มกะ
   */
  openingCash: number;
  /**
   * เงินสดปิดกะ - จำนวนเงินสดที่ปิดกะ (null = ยังไม่ปิด)
   * ใช้สำหรับคำนวณผลต่าง
   */
  closingCash?: number | null;
  /**
   * เงินสดที่ควรมี - คำนวณจาก openingCash + cashSales
   * ใช้เปรียบเทียบกับ actualCash เพื่อหาผลต่าง
   */
  expectedCash: number;
  /**
   * เงินสดจริงที่นับได้ - จำนวนเงินสดที่นับจริงตอนปิดกะ (null = ยังไม่นับ)
   */
  actualCash?: number | null;
  /**
   * ผลต่างเงินสด - คำนวณจาก actualCash - expectedCash
   * ค่าบวก = เกิน, ค่าลบ = ขาด, 0 = ตรง
   */
  cashDifference?: number | null;
  /**
   * ยอดขายรวม - รวมทั้งเงินสดและเครดิต
   */
  totalSales: number;
  /**
   * ยอดขายเงินสด - ยอดขายที่ชำระด้วยเงินสด
   */
  cashSales: number;
  /**
   * ยอดขายเครดิต - ยอดขายที่ชำระด้วยเครดิต (ค้างชำระ)
   */
  creditSales: number;
  /**
   * จำนวนรายการขาย - จำนวนครั้งที่ขายในกะนี้
   */
  saleCount: number;
  /**
   * สถานะกะ - "open" = เปิดอยู่, "closed" = ปิดแล้ว
   */
  status: "open" | "closed";
  /**
   * หมายเหตุ - ข้อมูลเพิ่มเติม เช่น เหตุผลที่เงินสดไม่ตรง
   */
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ShiftSchema = new Schema<IShift>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
      index: true,
    },
    shiftNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    shiftDate: {
      type: Date,
      required: true,
      // Normalize to start of day (00:00:00)
      set: (date: Date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
      },
      index: true,
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: {
      type: Date,
      required: false,
      default: null,
    },
    openingCash: {
      type: Number,
      required: true,
      min: 0,
    },
    closingCash: {
      type: Number,
      required: false,
      default: null,
      min: 0,
    },
    expectedCash: {
      type: Number,
      required: true,
      min: 0,
    },
    actualCash: {
      type: Number,
      required: false,
      default: null,
      min: 0,
    },
    cashDifference: {
      type: Number,
      required: false,
      default: null,
    },
    totalSales: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    cashSales: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    creditSales: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    saleCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
      required: true,
      index: true,
    },
    notes: {
      type: String,
      required: false,
      default: null,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index สำหรับค้นหากะปัจจุบันและประวัติ
// userId + shiftDate + status: สำหรับค้นหากะที่เปิดอยู่ของวันนี้
ShiftSchema.index({ userId: 1, shiftDate: 1, status: 1 });

// Index เพิ่มเติมสำหรับค้นหาประวัติ
// userId + shiftDate: สำหรับดึงกะทั้งหมดของวัน
ShiftSchema.index({ userId: 1, shiftDate: -1 });

// Index สำหรับค้นหากะที่เปิดอยู่
ShiftSchema.index({ userId: 1, status: 1, startTime: -1 });

export const Shift = mongoose.model<IShift>("Shift", ShiftSchema);
