import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./trpc";
import * as db from "../db";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // ==================== SETTINGS ====================
  settings: router({
    /**
     * ดึง settings ปัจจุบัน
     */
    get: publicProcedure.query(async () => {
      const settings = await db.getSettings();
      return {
        vatEnabled: settings.vatEnabled ?? false,
        sellerName: settings.sellerName ?? "",
        sellerAddress: settings.sellerAddress ?? "",
        sellerTaxId: settings.sellerTaxId ?? "",
      };
    }),

    /**
     * อัปเดต settings (ผู้ที่ login แล้วสามารถตั้งค่าได้ - ข้อมูลระดับร้าน)
     */
    update: protectedProcedure
      .input(
        z.object({
          vatEnabled: z.boolean().optional(),
          sellerName: z.string().optional(),
          sellerAddress: z.string().optional(),
          sellerTaxId: z
            .string()
            .optional()
            .refine(
              (val) => {
                if (!val || val.trim() === "") return true; // Optional
                // ลบช่องว่างและขีดออก แล้วตรวจสอบว่าเป็นตัวเลข 13 หลัก
                const cleaned = val.replace(/\s|-/g, "");
                return /^\d{13}$/.test(cleaned);
              },
              {
                message: "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก",
              }
            ),
        })
      )
      .mutation(async ({ input }) => {
        // ถ้ามี sellerTaxId ให้ลบช่องว่างและขีดออกก่อนบันทึก
        const processedInput = { ...input };
        if (processedInput.sellerTaxId) {
          processedInput.sellerTaxId = processedInput.sellerTaxId.replace(/\s|-/g, "");
        }

        const updated = await db.updateSettings(processedInput);
        return {
          success: true,
          settings: {
            vatEnabled: updated.vatEnabled ?? false,
            sellerName: updated.sellerName ?? "",
            sellerAddress: updated.sellerAddress ?? "",
            sellerTaxId: updated.sellerTaxId ?? "",
          },
        };
      }),
  }),
});
