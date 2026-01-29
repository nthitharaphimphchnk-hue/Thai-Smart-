import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
// Cloudinary ปิดชั่วคราว — ใช้รูป local (client/public/products/) เท่านั้น
// import { uploadProductImage as uploadToCloudinary } from "./_core/cloudinary";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
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
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const user = await db.createUserWithPassword({
            email: input.email,
            password: input.password,
            name: input.name,
          });

          // Create session token
          const { sdk } = await import("./_core/sdk");
          const sessionToken = await sdk.createSessionToken(String(user.id), {
            name: user.name || "User",
            expiresInMs: ONE_YEAR_MS,
          });

          // Set cookie
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

          // Update last signed in
          await db.updateUserLastSignedIn(user.id);

          return { success: true, user };
        } catch (error: any) {
          console.error("[Auth] Register error:", error);
          if (error.message === "Email already registered" || error.message?.includes("duplicate")) {
            throw new Error("อีเมลนี้ถูกใช้งานแล้ว");
          }
          // Log full error for debugging
          console.error("[Auth] Register error details:", {
            message: error.message,
            stack: error.stack,
            name: error.name,
          });
          throw new Error(error.message || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
        }
      }),
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const user = await db.getUserByEmail(input.email);
          
          if (!user) {
            throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
          }

          const isValid = await db.verifyPassword(user, input.password);
          if (!isValid) {
            throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
          }

          // Create session token
          const { sdk } = await import("./_core/sdk");
          const sessionToken = await sdk.createSessionToken(String(user.id), {
            name: user.name || "User",
            expiresInMs: ONE_YEAR_MS,
          });

          // Set cookie
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

          // Update last signed in
          await db.updateUserLastSignedIn(user.id);

          // Don't return password
          const { password: _, ...userWithoutPassword } = user;
          return { success: true, user: userWithoutPassword };
        } catch (error: any) {
          console.error("[Auth] Login error:", error);
          // If it's already our custom error, re-throw it
          if (error.message === "อีเมลหรือรหัสผ่านไม่ถูกต้อง") {
            throw error;
          }
          throw new Error(error.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
        }
      }),
  }),

  // ==================== PRODUCTS ====================
  products: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getProductsByUser(ctx.user.id);
    }),

    /* Cloudinary ปิดชั่วคราว — ใช้รูป local (ใส่ชื่อไฟล์ใน imageUrl) เท่านั้น
    uploadImage: protectedProcedure
      .input(...)
      .mutation(...),
    */

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        price: z.string(),
        stock: z.number().default(0),
        reorderPoint: z.number().default(5),
        minStock: z.number().optional(), // legacy alias
        barcode: z.string().optional(),
        imageUrl: z.string().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createProduct({
          userId: ctx.user.id,
          name: input.name,
          price: input.price,
          stock: input.stock,
          reorderPoint: input.reorderPoint ?? input.minStock,
          barcode: input.barcode,
          imageUrl: input.imageUrl,
        });
        return { id };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.union([z.string(), z.number()]),
        name: z.string().min(1).optional(),
        price: z.string().optional(),
        stock: z.number().optional(),
        reorderPoint: z.number().optional(),
        minStock: z.number().optional(), // legacy alias
        barcode: z.string().optional(),
        imageUrl: z.string().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateProduct(id, ctx.user.id, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.union([z.string(), z.number()]) }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteProduct(input.id, ctx.user.id);
        return { success: true };
      }),
    
    lowStock: protectedProcedure.query(async ({ ctx }) => {
      return db.getLowStockProducts(ctx.user.id);
    }),
    
    byBarcode: protectedProcedure
      .input(z.object({ barcode: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const product = await db.getProductByBarcode(ctx.user.id, input.barcode);
        return product ?? null;
      }),
    
    import: protectedProcedure
      .input(z.object({
        products: z.array(z.object({
          name: z.string().min(1),
          price: z.union([z.string(), z.number()]),
          stock: z.number().optional(),
          reorderPoint: z.number().optional(),
          minStock: z.number().optional(), // legacy alias
          imageUrl: z.string().optional().nullable(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const productsToImport = input.products.map((p) => ({
            userId: ctx.user.id,
            name: p.name,
            price: typeof p.price === "string" ? p.price : String(p.price),
            stock: p.stock,
            reorderPoint: p.reorderPoint ?? p.minStock,
            imageUrl: p.imageUrl,
          }));
          
          const createdIds = await db.createProductsBulk(productsToImport);
          return { 
            success: true, 
            count: createdIds.length,
            ids: createdIds 
          };
        } catch (error: any) {
          console.error("[Products] Import error:", error);
          throw new Error(error.message || "เกิดข้อผิดพลาดในการนำเข้าสินค้า");
        }
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
          productId: z.union([z.string(), z.number()]),
          productName: z.string(),
          quantity: z.number().min(1),
          unitPrice: z.string(),
        })),
        paymentType: z.enum(["cash", "credit"]),
        customerName: z.string().optional(),
        vatRate: z.number().min(0).max(0.07).optional(), // 0 = ไม่คิด VAT, 0.07 = คิด 7%
      }))
      .mutation(async ({ ctx, input }) => {
        // Calculate total
        const totalAmount = input.items.reduce((sum, item) => {
          return sum + (parseFloat(item.unitPrice) * item.quantity);
        }, 0);
        
        // Calculate VAT
        const vatRate = input.vatRate ?? 0; // frontend ส่งมา หรือ default 0
        const subtotal = totalAmount;
        const vatAmount = subtotal * vatRate;
        const totalWithVat = subtotal + vatAmount;
        
        let customerId: string | number | null = null;
        
        // Handle credit sale - create or find customer
        if (input.paymentType === "credit" && input.customerName) {
          let customer = await db.getCustomerByName(input.customerName, ctx.user.id);
          if (!customer) {
            customerId = await db.createCustomer({
              userId: ctx.user.id,
              name: input.customerName,
              totalDebt: totalWithVat.toFixed(2), // ใช้ totalWithVat สำหรับลูกหนี้
            });
          } else {
            customerId = customer.id as string | number;
            await db.updateCustomerDebt(customer.id, totalWithVat); // ใช้ totalWithVat สำหรับลูกหนี้
          }
        }
        
        // Create sale
        const saleId = await db.createSale({
          userId: ctx.user.id,
          customerId,
          totalAmount: totalAmount.toFixed(2), // เก็บ totalAmount เดิมไว้ (backward compatible)
          paymentType: input.paymentType,
          vatRate,
          subtotal,
          vatAmount,
          totalWithVat,
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
          await db.updateProductStock(
            item.productId,
            -item.quantity,
            "SALE",
            `sale:${saleId}`
          );
        }
        
        return { saleId, totalAmount };
      }),
    
    today: protectedProcedure.query(async ({ ctx }) => {
      return db.getTodaySales(ctx.user.id);
    }),
  }),

  // ==================== STOCK MANAGEMENT ====================
  stock: router({
    in: protectedProcedure
      .input(
        z.object({
          productId: z.union([z.string(), z.number()]),
          quantity: z.number().min(1),
          note: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Ensure product belongs to the current user before adjusting stock.
        const product = await db.getProductById(input.productId, ctx.user.id);
        if (!product) throw new Error("ไม่พบสินค้า");

        const updated = await db.stockInPurchase({
          productId: input.productId,
          quantity: input.quantity,
          note: input.note ?? null,
        });

        return { success: true, product: updated };
      }),

    movements: protectedProcedure
      .input(
        z
          .object({
            limit: z.number().optional(),
            cursor: z.string().optional(),
            productId: z.union([z.string(), z.number()]).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        return db.getStockMovementsByUser({
          userId: ctx.user.id,
          limit: input?.limit,
          cursor: input?.cursor ?? null,
          productId: input?.productId ?? null,
        });
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
        customerId: z.union([z.string(), z.number()]),
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

  // ==================== AI ENDPOINTS ====================
  ai: router({
    /**
     * ดึงรายละเอียดยอดขายวันนี้พร้อมรายการสินค้า
     */
    todaySalesDetail: protectedProcedure.query(async ({ ctx }) => {
      const todaySalesData = await db.getTodaySales(ctx.user.id);
      const soldItems = await db.getTodaySoldItems(ctx.user.id);

      return {
        totalAmount: todaySalesData.totalSales,
        totalCount: todaySalesData.saleCount,
        items: soldItems.map((item) => ({
          productName: item.productName,
          quantity: item.totalQuantity,
          amount: item.totalAmount,
        })),
      };
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
      .input(z.object({ saleId: z.union([z.string(), z.number()]) }))
      .query(async ({ ctx, input }) => {
        const receiptData = await db.getReceiptData(input.saleId);
        const receiptText = db.formatReceiptText(receiptData);
        return { receiptText, receiptData };
      }),
  }),

  // ==================== FULL TAX INVOICE ====================
  fullTaxInvoice: router({
    /**
     * ดึงข้อมูล Sale สำหรับสร้างใบกำกับภาษีเต็ม
     * ตรวจสอบว่ามี VAT หรือไม่
     */
    getSaleData: protectedProcedure
      .input(z.object({ saleId: z.union([z.string(), z.number()]) }))
      .query(async ({ ctx, input }) => {
        const saleData = await db.getSaleForFullTaxInvoice(input.saleId);
        if (!saleData) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Sale not found or does not have VAT",
          });
        }
        return saleData;
      }),

    /**
     * ตรวจสอบว่ามีใบกำกับภาษีเต็มอยู่แล้วหรือไม่
     */
    checkExists: protectedProcedure
      .input(z.object({ saleId: z.union([z.string(), z.number()]) }))
      .query(async ({ ctx, input }) => {
        const invoice = await db.getFullTaxInvoiceBySaleId(input.saleId);
        return invoice !== undefined;
      }),

    /**
     * สร้างใบกำกับภาษีเต็ม
     */
    create: protectedProcedure
      .input(
        z.object({
          saleId: z.union([z.string(), z.number()]),
          buyerName: z.string().min(1, "ชื่อผู้ซื้อต้องไม่ว่าง"),
          buyerAddress: z.string().min(1, "ที่อยู่ผู้ซื้อต้องไม่ว่าง"),
          buyerTaxId: z.string().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const invoiceId = await db.createFullTaxInvoice({
            userId: ctx.user.id,
            saleId: input.saleId,
            buyerName: input.buyerName,
            buyerAddress: input.buyerAddress,
            buyerTaxId: input.buyerTaxId ?? null,
          });
          return { invoiceId, success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message || "Failed to create full tax invoice",
          });
        }
      }),

    /**
     * ดึงใบกำกับภาษีเต็มพร้อมข้อความที่ format แล้ว
     */
    get: protectedProcedure
      .input(z.object({ saleId: z.union([z.string(), z.number()]) }))
      .query(async ({ ctx, input }) => {
        const invoice = await db.getFullTaxInvoiceBySaleId(input.saleId);
        if (!invoice) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Full tax invoice not found",
          });
        }

        // ดึงข้อมูล Sale items
        const saleData = await db.getSaleForFullTaxInvoice(input.saleId);
        if (!saleData) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Sale data not found",
          });
        }

        // Format ใบกำกับภาษีเต็ม
        const invoiceText = db.formatFullTaxInvoiceText({
          invoiceNumber: invoice.invoiceNumber,
          issuedDate: invoice.issuedDate,
          sellerName: invoice.sellerName,
          sellerAddress: invoice.sellerAddress,
          sellerTaxId: invoice.sellerTaxId,
          buyerName: invoice.buyerName,
          buyerAddress: invoice.buyerAddress,
          buyerTaxId: invoice.buyerTaxId ?? null,
          items: saleData.items,
          subtotal: invoice.subtotal,
          vatAmount: invoice.vatAmount,
          totalWithVat: invoice.totalWithVat,
          status: (invoice as any).status ?? "issued", // เพิ่ม status
        });

        return {
          invoiceId: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          invoiceText,
          invoiceData: {
            ...invoice,
            id: invoice._id.toString(),
            saleId: invoice.saleId.toString(),
            userId: invoice.userId.toString(),
          },
          saleData: saleData, // เพิ่ม saleData เพื่อใช้ใน PDF
        };
      }),

    /**
     * ดึงรายการใบกำกับภาษีเต็มทั้งหมด (สำหรับบัญชี/ตรวจสอบ)
     */
    list: protectedProcedure
      .input(
        z
          .object({
            limit: z.number().min(1).max(100).default(50),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const invoices = await db.getFullTaxInvoices(ctx.user.id, input?.limit ?? 50);
        return invoices;
      }),

    /**
     * ยกเลิกใบกำกับภาษีเต็ม
     * - ห้ามลบจากระบบ
     * - ต้องยังคงเลขที่เอกสาร
     * - เปลี่ยนสถานะเป็น "cancelled"
     */
    cancel: protectedProcedure
      .input(
        z.object({
          invoiceId: z.union([z.string(), z.number()]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          await db.cancelFullTaxInvoice(input.invoiceId, ctx.user.id);
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message || "ไม่สามารถยกเลิกใบกำกับภาษีเต็มได้",
          });
        }
      }),
  }),

  // ==================== SHIFT CLOSING ====================
  shift: router({
    /**
     * เปิดกะใหม่
     * - เช็คว่ามีกะเปิดอยู่แล้วหรือไม่
     * - สร้าง Shift ใหม่พร้อม openingCash
     */
    open: protectedProcedure
      .input(
        z.object({
          openingCash: z.number().min(0),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // เช็คว่ามีกะเปิดอยู่แล้วหรือไม่
        const existingShift = await db.getOpenShiftToday(ctx.user.id);
        if (existingShift) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "มีการเปิดกะอยู่แล้ว",
          });
        }

        // หา shiftNumber ของวันนี้ (max + 1)
        const maxShiftNumber = await db.getMaxShiftNumberToday(ctx.user.id);
        const shiftNumber = maxShiftNumber + 1;

        // สร้าง Shift ใหม่
        const today = new Date();
        const shift = await db.createShift({
          userId: ctx.user.id,
          shiftNumber,
          shiftDate: today,
          startTime: new Date(),
          openingCash: input.openingCash,
          expectedCash: input.openingCash, // เริ่มต้นเท่ากับ openingCash
          totalSales: 0,
          cashSales: 0,
          creditSales: 0,
          saleCount: 0,
          status: "open",
        });

        return shift;
      }),

    /**
     * ปิดกะ
     * - ดึงยอดขายทั้งหมดตั้งแต่เปิดกะ
     * - คำนวณ expectedCash, cashDifference
     * - อัปเดต Shift เป็น closed
     */
    close: protectedProcedure
      .input(
        z.object({
          closingCash: z.number().min(0),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // หา shift ที่เปิดอยู่
        const shift = await db.getOpenShiftToday(ctx.user.id);
        if (!shift) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "ยังไม่ได้เปิดกะ",
          });
        }

        // ดึงยอดขายทั้งหมดตั้งแต่ shift.startTime ถึง now
        const endTime = new Date();
        const salesSummary = await db.getSalesSummaryForShift(
          ctx.user.id,
          shift.startTime,
          endTime
        );

        // คำนวณ expectedCash และ cashDifference
        const expectedCash = shift.openingCash + salesSummary.cashSales;
        const actualCash = input.closingCash;
        const cashDifference = actualCash - expectedCash;

        // อัปเดต Shift
        const closedShift = await db.closeShift(shift.id, {
          endTime,
          closingCash: input.closingCash,
          expectedCash,
          actualCash,
          cashDifference,
          totalSales: salesSummary.totalSales,
          cashSales: salesSummary.cashSales,
          creditSales: salesSummary.creditSales,
          saleCount: salesSummary.saleCount,
          notes: input.notes ?? null,
        });

        // Return summary
        return {
          shift: closedShift,
          summary: {
            openingCash: shift.openingCash,
            closingCash: input.closingCash,
            expectedCash,
            actualCash,
            cashDifference,
            totalSales: salesSummary.totalSales,
            cashSales: salesSummary.cashSales,
            creditSales: salesSummary.creditSales,
            saleCount: salesSummary.saleCount,
            startTime: shift.startTime,
            endTime,
          },
        };
      }),

    /**
     * ดึงกะของวันนี้ (ล่าสุด)
     */
    today: protectedProcedure.query(async ({ ctx }) => {
      const shift = await db.getTodayShift(ctx.user.id);
      return shift;
    }),
  }),

  chat: router({
    send: protectedProcedure
      .input(z.object({ message: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        // Save user message first (same behavior asเดิม)
        await db.createChatLog({
          userId: ctx.user.id,
          role: "user",
          content: input.message,
        });

        try {
          // Use existing analytics as the single source of truth
          const analytics = await db.getAnalytics(ctx.user.id);

          const normalized = input.message.toLowerCase().trim();

          const isTodaySalesQuestion =
            /วันนี้.*ขาย/.test(normalized) ||
            /ขาย.*วันนี้/.test(normalized) ||
            /ยอด.*วันนี้/.test(normalized) ||
            /ยอดขายวันนี้/.test(normalized);

          const isLowStockQuestion =
            /ใกล้หมด/.test(normalized) ||
            /ของ.*หมด/.test(normalized) ||
            /สต็อก.*น้อย/.test(normalized) ||
            /ของ.*จะหมด/.test(normalized);

          const isDebtorsQuestion =
            /ค้างเงิน/.test(normalized) ||
            /ลูกหนี้/.test(normalized) ||
            /ใคร.*ค้าง/.test(normalized);

          const isReorderTomorrowQuestion =
            /พรุ่งนี้.*ซื้อ/.test(normalized) ||
            /ควร.*ซื้อ/.test(normalized) ||
            /สั่ง.*ซื้อ/.test(normalized) ||
            /ต้องซื้ออะไร/.test(normalized);

          let aiResponse: string;

          if (isTodaySalesQuestion) {
            // เรียก API เพื่อดึงรายละเอียดยอดขายพร้อมรายการสินค้า
            const salesDetail = await db.getTodaySales(ctx.user.id);
            const soldItems = await db.getTodaySoldItems(ctx.user.id);
            
            const amount = Math.round(salesDetail.totalSales);
            const count = salesDetail.saleCount;
            
            if (amount === 0 && count === 0) {
              aiResponse = "วันนี้ยังไม่มีการขายเลยครับ";
            } else {
              // สร้างคำตอบแบบละเอียดพร้อมรายการสินค้า
              let response = `วันนี้ขายได้ ${amount.toLocaleString("th-TH")} บาท ทั้งหมด ${count} รายการครับ\n\n`;
              
              if (soldItems.length > 0) {
                response += "รายการสินค้าที่ขาย:\n";
                // แสดงไม่เกิน 5-6 รายการ
                const displayItems = soldItems.slice(0, 6);
                const hasMore = soldItems.length > 6;
                
                displayItems.forEach((item) => {
                  response += `• ${item.productName}: ${item.totalQuantity} ชิ้น (${item.totalAmount.toLocaleString("th-TH")} บาท)\n`;
                });
                
                if (hasMore) {
                  response += `และอื่น ๆ อีก ${soldItems.length - 6} รายการ`;
                }
              }
              
              aiResponse = response;
            }
          } else if (isLowStockQuestion) {
            const items = analytics.lowStockProducts ?? [];
            if (items.length === 0) {
              aiResponse = "ตอนนี้ยังไม่มีสินค้าใกล้หมดครับ สต็อกยังสบายๆ";
            } else {
              const lines = items.map(
                (p: any) =>
                  `• ${p.name}: เหลือ ${p.stock} ชิ้น (จุดสั่งซื้อ ${((p as any).reorderPoint ?? (p as any).minStock ?? 5).toLocaleString("th-TH")} ชิ้น)`
              );
              aiResponse =
                `ตอนนี้มีสินค้าใกล้หมด ${items.length} รายการครับ:\n` +
                lines.join("\n");
            }
          } else if (isDebtorsQuestion) {
            const debtors = analytics.topDebtors ?? [];
            const totalDebt = Math.round(analytics.totalDebt ?? 0);
            if (debtors.length === 0 || totalDebt === 0) {
              aiResponse = "ตอนนี้ยังไม่มีลูกค้าค้างเงินครับ ทุกคนจ่ายครบแล้ว";
            } else {
              const lines = debtors.map(
                (c: any) =>
                  `• ${c.name}: ค้างประมาณ ${parseFloat(String(c.totalDebt)).toLocaleString("th-TH")} บาท`
              );
              aiResponse =
                `ตอนนี้มีลูกค้าค้างเงินอยู่ ${debtors.length} ราย รวมประมาณ ${totalDebt.toLocaleString(
                  "th-TH"
                )} บาทครับ:\n` + lines.join("\n");
            }
          } else if (isReorderTomorrowQuestion) {
            const items = analytics.lowStockProducts ?? [];
            if (items.length === 0) {
              aiResponse =
                "จากข้อมูลตอนนี้ ยังไม่มีสินค้าที่น่าเป็นห่วงเป็นพิเศษ พรุ่งนี้ยังไม่จำเป็นต้องรีบสั่งของครับ";
            } else {
              const lines = items.map(
                (p: any) =>
                  `• ${p.name}: เหลือ ${p.stock} ชิ้น (ควรมีอย่างน้อย ${((p as any).reorderPoint ?? (p as any).minStock ?? 5).toLocaleString(
                    "th-TH"
                  )} ชิ้น)`
              );
              aiResponse =
                "ถ้าจะสั่งของพรุ่งนี้ ผมแนะนำเริ่มจากรายการใกล้หมดเหล่านี้ก่อนครับ:\n" +
                lines.join("\n");
            }
          } else {
            aiResponse =
              "ตอนนี้ผมช่วยตอบได้เฉพาะเรื่องพื้นฐานของร้าน เช่น:\n" +
              "- วันนี้ขายได้เท่าไหร่\n" +
              "- ของอะไรใกล้หมด\n" +
              "- ใครค้างเงินอยู่\n" +
              "- พรุ่งนี้ควรซื้ออะไร\n" +
              "ลองถามใหม่อีกครั้งในรูปแบบนี้ได้เลยครับ 🙂";
          }

          // Save AI response (same behavior)
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
