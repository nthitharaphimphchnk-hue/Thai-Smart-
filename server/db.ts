import { eq, and, lte, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  products, InsertProduct, Product,
  sales, InsertSale,
  saleItems, InsertSaleItem,
  customers, InsertCustomer, Customer,
  chatLogs, InsertChatLog
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USER FUNCTIONS ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== PRODUCT FUNCTIONS ====================

export async function createProduct(product: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(products).values(product);
  return result[0].insertId;
}

export async function getProductsByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(products).where(eq(products.userId, userId)).orderBy(desc(products.updatedAt));
}

export async function getProductById(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(products)
    .where(and(eq(products.id, id), eq(products.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateProduct(id: number, userId: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(products)
    .set(data)
    .where(and(eq(products.id, id), eq(products.userId, userId)));
}

export async function deleteProduct(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(products).where(and(eq(products.id, id), eq(products.userId, userId)));
}

export async function getLowStockProducts(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(products)
    .where(and(
      eq(products.userId, userId),
      lte(products.stock, products.minStock)
    ))
    .orderBy(products.stock);
}

export async function updateProductStock(productId: number, quantityChange: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(products)
    .set({ stock: sql`${products.stock} + ${quantityChange}` })
    .where(eq(products.id, productId));
}

// ==================== SALES FUNCTIONS ====================

export async function createSale(sale: InsertSale) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(sales).values(sale);
  return result[0].insertId;
}

export async function createSaleItems(items: InsertSaleItem[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(saleItems).values(items);
}

export async function getSalesByUser(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(sales)
    .where(eq(sales.userId, userId))
    .orderBy(desc(sales.createdAt))
    .limit(limit);
}

export async function getSaleItems(saleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
}

export async function getTodaySales(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await db.select({
    totalSales: sql<string>`COALESCE(SUM(${sales.totalAmount}), 0)`,
    saleCount: sql<number>`COUNT(*)`,
  }).from(sales)
    .where(and(
      eq(sales.userId, userId),
      sql`DATE(${sales.createdAt}) = CURDATE()`
    ));
  
  return {
    totalSales: parseFloat(result[0]?.totalSales || "0"),
    saleCount: result[0]?.saleCount || 0,
  };
}

// ==================== CUSTOMER FUNCTIONS ====================

export async function createCustomer(customer: InsertCustomer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(customers).values(customer);
  return result[0].insertId;
}

export async function getCustomersByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(customers)
    .where(eq(customers.userId, userId))
    .orderBy(desc(customers.updatedAt));
}

export async function getCustomerById(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(customers)
    .where(and(eq(customers.id, id), eq(customers.userId, userId)))
    .limit(1);
  return result[0];
}

export async function getCustomerByName(name: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(customers)
    .where(and(eq(customers.name, name), eq(customers.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateCustomerDebt(customerId: number, amount: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(customers)
    .set({ totalDebt: sql`${customers.totalDebt} + ${amount}` })
    .where(eq(customers.id, customerId));
}

export async function getCustomersWithDebt(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(customers)
    .where(and(
      eq(customers.userId, userId),
      sql`${customers.totalDebt} > 0`
    ))
    .orderBy(desc(customers.totalDebt));
}

export async function payDebt(customerId: number, userId: number, amount: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(customers)
    .set({ totalDebt: sql`GREATEST(${customers.totalDebt} - ${amount}, 0)` })
    .where(and(eq(customers.id, customerId), eq(customers.userId, userId)));
}

// ==================== CHAT LOG FUNCTIONS ====================

export async function createChatLog(log: InsertChatLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(chatLogs).values(log);
}

export async function getChatLogs(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(chatLogs)
    .where(eq(chatLogs.userId, userId))
    .orderBy(desc(chatLogs.createdAt))
    .limit(limit);
}

// ==================== ANALYTICS FUNCTIONS ====================

export async function getAnalytics(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const todaySalesData = await getTodaySales(userId);
  const lowStockData = await getLowStockProducts(userId);
  const debtorsData = await getCustomersWithDebt(userId);
  
  const totalDebt = debtorsData.reduce((sum, c) => sum + parseFloat(c.totalDebt as string), 0);
  
  return {
    todaySales: todaySalesData.totalSales,
    todaySaleCount: todaySalesData.saleCount,
    lowStockCount: lowStockData.length,
    lowStockProducts: lowStockData.slice(0, 5),
    debtorCount: debtorsData.length,
    totalDebt,
    topDebtors: debtorsData.slice(0, 5),
  };
}


// ==================== REPORT FUNCTIONS ====================

export async function getDailySales(userId: number, days = 7) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const dateExpr = sql`DATE(${sales.createdAt})`;
  
  const result = await db.select({
    date: sql<string>`DATE(${sales.createdAt})`.as('sale_date'),
    totalAmount: sql<string>`COALESCE(SUM(${sales.totalAmount}), 0)`,
    saleCount: sql<number>`COUNT(*)`,
  }).from(sales)
    .where(and(
      eq(sales.userId, userId),
      sql.raw(`\`sales\`.\`createdAt\` >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`)
    ))
    .groupBy(sql`sale_date`)
    .orderBy(sql`sale_date`);
  
  return result.map(r => ({
    date: r.date,
    totalAmount: parseFloat(r.totalAmount || "0"),
    saleCount: r.saleCount,
  }));
}

export async function getMonthlySales(userId: number, months = 6) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const monthExpr = sql`DATE_FORMAT(${sales.createdAt}, '%Y-%m')`;
  
  const result = await db.select({
    month: sql<string>`DATE_FORMAT(${sales.createdAt}, '%Y-%m')`.as('sale_month'),
    monthName: sql<string>`MAX(DATE_FORMAT(${sales.createdAt}, '%b %Y'))`,
    totalAmount: sql<string>`COALESCE(SUM(${sales.totalAmount}), 0)`,
    saleCount: sql<number>`COUNT(*)`,
  }).from(sales)
    .where(and(
      eq(sales.userId, userId),
      sql.raw(`\`sales\`.\`createdAt\` >= DATE_SUB(CURDATE(), INTERVAL ${months} MONTH)`)
    ))
    .groupBy(sql`sale_month`)
    .orderBy(sql`sale_month`);
  
  return result.map(r => ({
    month: r.month,
    monthName: r.monthName,
    totalAmount: parseFloat(r.totalAmount || "0"),
    saleCount: r.saleCount,
  }));
}

export async function getTopSellingProducts(userId: number, limit = 5) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select({
    productId: saleItems.productId,
    productName: saleItems.productName,
    totalQuantity: sql<number>`SUM(${saleItems.quantity})`,
    totalRevenue: sql<string>`SUM(${saleItems.totalPrice})`,
  }).from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(eq(sales.userId, userId))
    .groupBy(saleItems.productId, saleItems.productName)
    .orderBy(desc(sql`SUM(${saleItems.quantity})`))
    .limit(limit);
  
  return result.map(r => ({
    productId: r.productId,
    productName: r.productName,
    totalQuantity: r.totalQuantity,
    totalRevenue: parseFloat(r.totalRevenue || "0"),
  }));
}

export async function getSalesSummary(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Today's sales
  const todayResult = await db.select({
    totalAmount: sql<string>`COALESCE(SUM(${sales.totalAmount}), 0)`,
    saleCount: sql<number>`COUNT(*)`,
  }).from(sales)
    .where(and(
      eq(sales.userId, userId),
      sql`DATE(${sales.createdAt}) = CURDATE()`
    ));
  
  // This week's sales
  const weekResult = await db.select({
    totalAmount: sql<string>`COALESCE(SUM(${sales.totalAmount}), 0)`,
    saleCount: sql<number>`COUNT(*)`,
  }).from(sales)
    .where(and(
      eq(sales.userId, userId),
      sql`YEARWEEK(${sales.createdAt}, 1) = YEARWEEK(CURDATE(), 1)`
    ));
  
  // This month's sales
  const monthResult = await db.select({
    totalAmount: sql<string>`COALESCE(SUM(${sales.totalAmount}), 0)`,
    saleCount: sql<number>`COUNT(*)`,
  }).from(sales)
    .where(and(
      eq(sales.userId, userId),
      sql`YEAR(${sales.createdAt}) = YEAR(CURDATE()) AND MONTH(${sales.createdAt}) = MONTH(CURDATE())`
    ));
  
  return {
    today: {
      totalAmount: parseFloat(todayResult[0]?.totalAmount || "0"),
      saleCount: todayResult[0]?.saleCount || 0,
    },
    thisWeek: {
      totalAmount: parseFloat(weekResult[0]?.totalAmount || "0"),
      saleCount: weekResult[0]?.saleCount || 0,
    },
    thisMonth: {
      totalAmount: parseFloat(monthResult[0]?.totalAmount || "0"),
      saleCount: monthResult[0]?.saleCount || 0,
    },
  };
}


// ==================== RECEIPT FUNCTIONS ====================

export async function getReceiptData(saleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get sale info
  const saleData = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);
  if (saleData.length === 0) throw new Error("Sale not found");
  
  const sale = saleData[0];
  
  // Get sale items
  const items = await db.select({
    productName: saleItems.productName,
    quantity: saleItems.quantity,
    unitPrice: saleItems.unitPrice,
    totalPrice: saleItems.totalPrice,
  }).from(saleItems)
    .where(eq(saleItems.saleId, saleId));
  
  // Get customer info if exists
  let customerName = "ลูกค้าทั่วไป";
  if (sale.customerId) {
    const customerData = await db.select().from(customers).where(eq(customers.id, sale.customerId)).limit(1);
    if (customerData.length > 0) {
      customerName = customerData[0].name;
    }
  }
  
  return {
    saleId: sale.id,
    date: sale.createdAt,
    customerName,
    items,
    totalAmount: parseFloat(String(sale.totalAmount)),
    paymentType: sale.paymentType,
  };
}

export function formatReceiptText(receiptData: Awaited<ReturnType<typeof getReceiptData>>): string {
  const lines: string[] = [];
  
  // Header
  lines.push("================================");
  lines.push("        THAI SMART POS");
  lines.push("       ใบเสร็จอย่างย่อ");
  lines.push("================================");
  lines.push("");
  
  // Date and receipt number
  const date = new Date(receiptData.date);
  const dateStr = date.toLocaleDateString("th-TH", { 
    year: "numeric", 
    month: "2-digit", 
    day: "2-digit" 
  });
  const timeStr = date.toLocaleTimeString("th-TH", { 
    hour: "2-digit", 
    minute: "2-digit" 
  });
  
  lines.push(`ใบเสร็จที่: ${receiptData.saleId}`);
  lines.push(`วันที่: ${dateStr} เวลา: ${timeStr}`);
  lines.push(`ลูกค้า: ${receiptData.customerName}`);
  lines.push("");
  
  // Items header
  lines.push("--------------------------------");
  lines.push("สินค้า          จำนวน  ราคา");
  lines.push("--------------------------------");
  
  // Items
  for (const item of receiptData.items) {
    const itemName = item.productName.substring(0, 15).padEnd(15);
    const qty = String(item.quantity).padStart(4);
    const price = String(Math.round(parseFloat(String(item.totalPrice)))).padStart(8);
    lines.push(`${itemName}${qty}  ฿${price}`);
  }
  
  lines.push("--------------------------------");
  
  // Total
  const totalStr = String(Math.round(receiptData.totalAmount)).padStart(8);
  lines.push(`รวมทั้งหมด:                ฿${totalStr}`);
  lines.push("");
  
  // Payment method
  if (receiptData.paymentType === "credit") {
    lines.push("วิธีชำระ: ขายเชื่อ");
  } else {
    lines.push("วิธีชำระ: เงินสด");
  }
  
  lines.push("");
  lines.push("================================");
  lines.push("    ขอบคุณที่ใช้บริการ");
  lines.push("================================");
  
  return lines.join("\n");
}
