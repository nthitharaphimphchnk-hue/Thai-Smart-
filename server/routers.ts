import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ==================== PRODUCTS ====================
  products: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getProductsByUser(ctx.user.id);
    }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        price: z.string(),
        stock: z.number().default(0),
        minStock: z.number().default(5),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createProduct({
          userId: ctx.user.id,
          name: input.name,
          price: input.price,
          stock: input.stock,
          minStock: input.minStock,
        });
        return { id };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        price: z.string().optional(),
        stock: z.number().optional(),
        minStock: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateProduct(id, ctx.user.id, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteProduct(input.id, ctx.user.id);
        return { success: true };
      }),
    
    lowStock: protectedProcedure.query(async ({ ctx }) => {
      return db.getLowStockProducts(ctx.user.id);
    }),
  }),

  // ==================== SALES ====================
  sales: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ ctx, input }) => {
        return db.getSalesByUser(ctx.user.id, input?.limit);
      }),
    
    create: protectedProcedure
      .input(z.object({
        items: z.array(z.object({
          productId: z.number(),
          productName: z.string(),
          quantity: z.number().min(1),
          unitPrice: z.string(),
        })),
        paymentType: z.enum(["cash", "credit"]),
        customerName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Calculate total
        const totalAmount = input.items.reduce((sum, item) => {
          return sum + (parseFloat(item.unitPrice) * item.quantity);
        }, 0);
        
        let customerId: number | null = null;
        
        // Handle credit sale - create or find customer
        if (input.paymentType === "credit" && input.customerName) {
          let customer = await db.getCustomerByName(input.customerName, ctx.user.id);
          if (!customer) {
            customerId = await db.createCustomer({
              userId: ctx.user.id,
              name: input.customerName,
              totalDebt: totalAmount.toFixed(2),
            });
          } else {
            customerId = customer.id;
            await db.updateCustomerDebt(customer.id, totalAmount);
          }
        }
        
        // Create sale
        const saleId = await db.createSale({
          userId: ctx.user.id,
          customerId,
          totalAmount: totalAmount.toFixed(2),
          paymentType: input.paymentType,
        });
        
        // Create sale items and update stock
        const saleItems = input.items.map(item => ({
          saleId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
        }));
        
        await db.createSaleItems(saleItems);
        
        // Update product stock
        for (const item of input.items) {
          await db.updateProductStock(item.productId, -item.quantity);
        }
        
        return { saleId, totalAmount };
      }),
    
    today: protectedProcedure.query(async ({ ctx }) => {
      return db.getTodaySales(ctx.user.id);
    }),
  }),

  // ==================== CUSTOMERS ====================
  customers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getCustomersByUser(ctx.user.id);
    }),
    
    withDebt: protectedProcedure.query(async ({ ctx }) => {
      return db.getCustomersWithDebt(ctx.user.id);
    }),
    
    payDebt: protectedProcedure
      .input(z.object({
        customerId: z.number(),
        amount: z.number().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.payDebt(input.customerId, ctx.user.id, input.amount);
        return { success: true };
      }),
  }),

  // ==================== ANALYTICS ====================
  analytics: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      return db.getAnalytics(ctx.user.id);
    }),
  }),

  // ==================== REPORTS ====================
  reports: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      return db.getSalesSummary(ctx.user.id);
    }),
    
    daily: protectedProcedure
      .input(z.object({ days: z.number().default(7) }).optional())
      .query(async ({ ctx, input }) => {
        return db.getDailySales(ctx.user.id, input?.days);
      }),
    
    monthly: protectedProcedure
      .input(z.object({ months: z.number().default(6) }).optional())
      .query(async ({ ctx, input }) => {
        return db.getMonthlySales(ctx.user.id, input?.months);
      }),
    
    topProducts: protectedProcedure
      .input(z.object({ limit: z.number().default(5) }).optional())
      .query(async ({ ctx, input }) => {
        return db.getTopSellingProducts(ctx.user.id, input?.limit);
      }),
  }),

  // ==================== RECEIPTS ====================
  receipts: router({
    generate: protectedProcedure
      .input(z.object({ saleId: z.number() }))
      .query(async ({ ctx, input }) => {
        const receiptData = await db.getReceiptData(input.saleId);
        const receiptText = db.formatReceiptText(receiptData);
        return { receiptText, receiptData };
      }),
  }),

  chat: router({
    send: protectedProcedure
      .input(z.object({ message: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        // Get analytics data for context
        const analytics = await db.getAnalytics(ctx.user.id);
        const allProducts = await db.getProductsByUser(ctx.user.id);
        
        // Build context for AI
        const contextData = `
ข้อมูลร้านค้าปัจจุบัน:
- ยอดขายวันนี้: ${analytics.todaySales.toLocaleString()} บาท (${analytics.todaySaleCount} รายการ)
- สินค้าใกล้หมด: ${analytics.lowStockCount} รายการ
${analytics.lowStockProducts.map(p => `  • ${p.name}: เหลือ ${p.stock} ชิ้น`).join('\n')}
- ลูกค้าค้างเงิน: ${analytics.debtorCount} คน (รวม ${analytics.totalDebt.toLocaleString()} บาท)
${analytics.topDebtors.map(c => `  • ${c.name}: ค้าง ${parseFloat(c.totalDebt as string).toLocaleString()} บาท`).join('\n')}
- สินค้าทั้งหมด: ${allProducts.length} รายการ
`;

        const systemPrompt = `คุณคือ "น้องสมาร์ท" ผู้ช่วย AI ของระบบ Thai Smart POS สำหรับร้านขายอุปกรณ์การเกษตรและร้านชุมชน

หน้าที่ของคุณ:
1. ตอบคำถามเกี่ยวกับข้อมูลร้านค้าเป็นภาษาไทยที่เข้าใจง่าย
2. ให้คำแนะนำเรื่องการจัดการร้าน
3. สรุปข้อมูลสำคัญให้เจ้าของร้าน

กฎการตอบ:
- ตอบสั้นๆ กระชับ เข้าใจง่าย
- ใช้ภาษาไทยที่เป็นกันเอง
- ไม่ต้องแสดงตาราง กราฟ หรือข้อมูลซับซ้อน
- ถ้าถูกถามเรื่องที่ไม่เกี่ยวกับร้าน ให้ตอบว่าช่วยได้เฉพาะเรื่องร้านค้า

${contextData}`;

        // Save user message
        await db.createChatLog({
          userId: ctx.user.id,
          role: "user",
          content: input.message,
        });

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: input.message },
            ],
          });

          const messageContent = response.choices[0]?.message?.content;
          const aiResponse = typeof messageContent === 'string' ? messageContent : "ขอโทษครับ ไม่สามารถตอบได้ในขณะนี้";

          // Save AI response
          await db.createChatLog({
            userId: ctx.user.id,
            role: "assistant",
            content: aiResponse,
          });

          return { response: aiResponse };
        } catch (error) {
          console.error("AI Chat error:", error);
          return { response: "ขอโทษครับ ระบบมีปัญหา กรุณาลองใหม่อีกครั้ง" };
        }
      }),
    
    history: protectedProcedure
      .input(z.object({ limit: z.number().default(20) }).optional())
      .query(async ({ ctx, input }) => {
        const logs = await db.getChatLogs(ctx.user.id, input?.limit);
        return logs.reverse(); // Return in chronological order
      }),
  }),
});

export type AppRouter = typeof appRouter;
