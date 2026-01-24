import { describe, expect, it } from "vitest";
import * as db from "./db";

describe("Receipt Functions", () => {
  describe("formatReceiptText", () => {
    it("should format receipt text with multiple items correctly", () => {
      const mockReceiptData = {
        saleId: 1,
        date: new Date("2026-01-20T10:30:00"),
        customerName: "สมชาย",
        items: [
          {
            productName: "ปุ๋ยยูเรีย",
            quantity: 2,
            unitPrice: "350",
            totalPrice: "700",
          },
          {
            productName: "ปุ๋ยซูเปอร์",
            quantity: 1,
            unitPrice: "450",
            totalPrice: "450",
          },
        ],
        totalAmount: 1150,
        paymentType: "cash" as const,
      };

      const result = db.formatReceiptText(mockReceiptData);

      // ตรวจสอบว่ามีข้อมูลสำคัญ
      expect(result).toContain("THAI SMART POS");
      expect(result).toContain("ใบเสร็จรับเงิน");
      expect(result).toContain("ใบเสร็จที่: 1");
      expect(result).toContain("ลูกค้า: สมชาย");
      expect(result).toContain("ปุ๋ยยูเรีย");
      expect(result).toContain("ปุ๋ยซูเปอร์");
      expect(result).toContain("รวมทั้งหมด:");
      expect(result).toContain("1,150"); // Formatted with thousand separator
      expect(result).toContain("วิธีชำระ: เงินสด");
      expect(result).toContain("ขอบคุณที่ใช้บริการ");
    });

    it("should handle credit payment type", () => {
      const mockReceiptData = {
        saleId: 2,
        date: new Date("2026-01-20T14:00:00"),
        customerName: "สมหญิง",
        items: [
          {
            productName: "ปุ๋ยเคมี",
            quantity: 3,
            unitPrice: "200",
            totalPrice: "600",
          },
        ],
        totalAmount: 600,
        paymentType: "credit" as const,
      };

      const result = db.formatReceiptText(mockReceiptData);

      expect(result).toContain("วิธีชำระ: ขายเชื่อ");
      expect(result).toContain("สมหญิง");
      expect(result).toContain("600"); // Small number, no separator
    });

    it("should format numbers correctly", () => {
      const mockReceiptData = {
        saleId: 3,
        date: new Date("2026-01-20T15:00:00"),
        customerName: "ร้านค้า",
        items: [
          {
            productName: "สินค้าแพง",
            quantity: 10,
            unitPrice: "5000",
            totalPrice: "50000",
          },
        ],
        totalAmount: 50000,
        paymentType: "cash" as const,
      };

      const result = db.formatReceiptText(mockReceiptData);

      expect(result).toContain("50,000"); // Formatted with thousand separator
      expect(result).toContain("ร้านค้า");
    });

    it("should handle empty items list", () => {
      const mockReceiptData = {
        saleId: 4,
        date: new Date("2026-01-20T16:00:00"),
        customerName: "ลูกค้า",
        items: [],
        totalAmount: 0,
        paymentType: "cash" as const,
      };

      const result = db.formatReceiptText(mockReceiptData);

      expect(result).toContain("THAI SMART POS");
      expect(result).toContain("รวมทั้งหมด:");
      expect(result).toContain("ขอบคุณที่ใช้บริการ");
    });

    it("should display receipt with correct format", () => {
      const mockReceiptData = {
        saleId: 5,
        date: new Date("2026-01-20T17:00:00"),
        customerName: "ลูกค้า",
        items: [
          {
            productName: "นี่คือชื่อสินค้าที่ยาวมากๆจริงๆ",
            quantity: 1,
            unitPrice: "100",
            totalPrice: "100",
          },
        ],
        totalAmount: 100,
        paymentType: "cash" as const,
      };

      const result = db.formatReceiptText(mockReceiptData);

      // ตรวจสอบว่ารูปแบบใบเสร็จมีความถูกต้อ
      expect(result).toContain("ใบเสร็จที่: 5");
      expect(result).toContain("ลูกค้า");
      expect(result).toContain("100");
    });
  });
});
