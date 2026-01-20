import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ENV } from "./_core/env";
import { User, IUser } from "./models/User";
import { Product, IProduct } from "./models/Product";
import { Sale, ISale } from "./models/Sale";
import { SaleItem, ISaleItem } from "./models/SaleItem";
import { Customer, ICustomer } from "./models/Customer";
import { ChatLog, IChatLog } from "./models/ChatLog";

// Helper function to convert string/number to ObjectId
function toObjectId(id: string | number | mongoose.Types.ObjectId): mongoose.Types.ObjectId {
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id === "string" && mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  // If it's a number (old MySQL id), we need to find by that field
  // For now, we'll treat it as string and convert
  return new mongoose.Types.ObjectId(String(id));
}

// Helper to convert userId (could be number from old system or ObjectId)
function toUserId(userId: string | number | mongoose.Types.ObjectId): mongoose.Types.ObjectId {
  return toObjectId(userId);
}

// ==================== USER FUNCTIONS ====================

export type InsertUser = {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role?: "user" | "admin";
  lastSignedIn?: Date;
};

export type User = IUser & { id: number | string };

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  try {
    const values: Partial<IUser> = {
      openId: user.openId,
    };

    if (user.name !== undefined) values.name = user.name;
    if (user.email !== undefined) values.email = user.email;
    if (user.loginMethod !== undefined) values.loginMethod = user.loginMethod;
    
    if (user.role !== undefined) {
      values.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
    } else {
      values.lastSignedIn = new Date();
    }

    await User.findOneAndUpdate(
      { openId: user.openId },
      { $set: values, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  try {
    const user = await User.findOne({ openId });
    if (!user) return undefined;
    
    return {
      ...user.toObject(),
      id: user._id.toString(),
    } as User;
  } catch (error) {
    console.warn("[Database] Cannot get user:", error);
    return undefined;
  }
}

export async function getUserByEmail(email: string) {
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) return undefined;
    
    return {
      ...user.toObject(),
      id: user._id.toString(),
    } as User;
  } catch (error) {
    console.warn("[Database] Cannot get user by email:", error);
    return undefined;
  }
}

export async function createUserWithPassword(data: {
  email: string;
  password: string;
  name?: string;
}) {
  try {
    // Check MongoDB connection and reconnect if needed
    const mongoose = await import("mongoose");
    if (mongoose.default.connection.readyState !== 1) {
      console.warn("[Database] MongoDB not connected, attempting to reconnect...");
      const { connectMongoDB } = await import("./mongodb");
      await connectMongoDB();
      
      // Check again after reconnect
      if (mongoose.default.connection.readyState !== 1) {
        throw new Error("Database not connected. Please check DATABASE_URL in .env file");
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    const newUser = new User({
      email: data.email.toLowerCase(),
      password: hashedPassword,
      name: data.name || null,
      loginMethod: "email",
      role: "user",
      lastSignedIn: new Date(),
    });

    const saved = await newUser.save();
    return {
      ...saved.toObject(),
      id: saved._id.toString(),
      password: undefined, // Don't return password
    } as User;
  } catch (error: any) {
    console.error("[Database] Failed to create user:", error);
    // Handle MongoDB duplicate key error
    if (error.code === 11000 || error.codeName === "DuplicateKey") {
      throw new Error("Email already registered");
    }
    // Handle validation errors
    if (error.name === "ValidationError") {
      throw new Error(`Validation error: ${error.message}`);
    }
    throw error;
  }
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  if (!user.password) {
    return false;
  }
  try {
    return await bcrypt.compare(password, user.password);
  } catch (error) {
    console.error("[Database] Password verification error:", error);
    return false;
  }
}

export async function updateUserLastSignedIn(userId: string | number | mongoose.Types.ObjectId) {
  await User.updateOne(
    { _id: toObjectId(userId) },
    { $set: { lastSignedIn: new Date() } }
  );
}

// ==================== PRODUCT FUNCTIONS ====================

export type InsertProduct = {
  userId: string | number | mongoose.Types.ObjectId;
  name: string;
  price: number | string;
  stock?: number;
  minStock?: number;
};

export type Product = IProduct & { id: number | string };

export async function createProduct(product: InsertProduct) {
  const newProduct = new Product({
    userId: toUserId(product.userId),
    name: product.name,
    price: typeof product.price === "string" ? parseFloat(product.price) : product.price,
    stock: product.stock ?? 0,
    minStock: product.minStock ?? 5,
  });

  const saved = await newProduct.save();
  return saved._id.toString();
}

export async function createProductsBulk(products: InsertProduct[]) {
  const productsToInsert = products.map((product) => ({
    userId: toUserId(product.userId),
    name: product.name.trim(),
    price: typeof product.price === "string" ? parseFloat(product.price) : product.price,
    stock: product.stock ?? 0,
    minStock: product.minStock ?? 5,
  }));

  // Validate all products before inserting
  for (const product of productsToInsert) {
    if (!product.name || product.name.length === 0) {
      throw new Error("ชื่อสินค้าไม่สามารถว่างได้");
    }
    if (isNaN(product.price) || product.price < 0) {
      throw new Error(`ราคาของสินค้า "${product.name}" ไม่ถูกต้อง`);
    }
  }

  const result = await Product.insertMany(productsToInsert);
  return result.map((p) => p._id.toString());
}

export async function getProductsByUser(userId: string | number | mongoose.Types.ObjectId) {
  const products = await Product.find({ userId: toUserId(userId) })
    .sort({ updatedAt: -1 })
    .lean();

  return products.map((p) => ({
    ...p,
    id: p._id.toString(),
    price: String(p.price),
  })) as any[];
}

export async function getProductById(id: string | number, userId: string | number | mongoose.Types.ObjectId) {
  const product = await Product.findOne({
    _id: toObjectId(id),
    userId: toUserId(userId),
  }).lean();

  if (!product) return undefined;

  return {
    ...product,
    id: product._id.toString(),
    price: String(product.price),
  } as any;
}

export async function updateProduct(id: string | number, userId: string | number | mongoose.Types.ObjectId, data: Partial<InsertProduct>) {
  const updateData: any = {};
  
  if (data.name !== undefined) updateData.name = data.name;
  if (data.price !== undefined) {
    updateData.price = typeof data.price === "string" ? parseFloat(data.price) : data.price;
  }
  if (data.stock !== undefined) updateData.stock = data.stock;
  if (data.minStock !== undefined) updateData.minStock = data.minStock;

  await Product.updateOne(
    { _id: toObjectId(id), userId: toUserId(userId) },
    { $set: updateData }
  );
}

export async function deleteProduct(id: string | number, userId: string | number | mongoose.Types.ObjectId) {
  await Product.deleteOne({
    _id: toObjectId(id),
    userId: toUserId(userId),
  });
}

export async function getLowStockProducts(userId: string | number | mongoose.Types.ObjectId) {
  const products = await Product.find({
    userId: toUserId(userId),
    $expr: { $lte: ["$stock", "$minStock"] },
  })
    .sort({ stock: 1 })
    .lean();

  return products.map((p) => ({
    ...p,
    id: p._id.toString(),
    price: String(p.price),
  })) as any[];
}

export async function updateProductStock(productId: string | number, quantityChange: number) {
  await Product.updateOne(
    { _id: toObjectId(productId) },
    { $inc: { stock: quantityChange } }
  );
}

// ==================== SALES FUNCTIONS ====================

export type InsertSale = {
  userId: string | number | mongoose.Types.ObjectId;
  customerId?: string | number | mongoose.Types.ObjectId | null;
  totalAmount: number | string;
  paymentType?: "cash" | "credit";
};

export type Sale = ISale & { id: number | string };

export async function createSale(sale: InsertSale) {
  const newSale = new Sale({
    userId: toUserId(sale.userId),
    customerId: sale.customerId ? toObjectId(sale.customerId) : null,
    totalAmount: typeof sale.totalAmount === "string" ? parseFloat(sale.totalAmount) : sale.totalAmount,
    paymentType: sale.paymentType ?? "cash",
  });

  const saved = await newSale.save();
  return saved._id.toString();
}

export type InsertSaleItem = {
  saleId: string | number | mongoose.Types.ObjectId;
  productId: string | number | mongoose.Types.ObjectId;
  productName: string;
  quantity: number;
  unitPrice: number | string;
  totalPrice: number | string;
};

export type SaleItem = ISaleItem & { id: number | string };

export async function createSaleItems(items: InsertSaleItem[]) {
  const saleItems = items.map((item) => ({
    saleId: toObjectId(item.saleId),
    productId: toObjectId(item.productId),
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: typeof item.unitPrice === "string" ? parseFloat(item.unitPrice) : item.unitPrice,
    totalPrice: typeof item.totalPrice === "string" ? parseFloat(item.totalPrice) : item.totalPrice,
  }));

  await SaleItem.insertMany(saleItems);
}

export async function getSalesByUser(userId: string | number | mongoose.Types.ObjectId, limit = 50) {
  const sales = await Sale.find({ userId: toUserId(userId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return sales.map((s) => ({
    ...s,
    id: s._id.toString(),
    totalAmount: String(s.totalAmount),
  })) as any[];
}

export async function getSaleItems(saleId: string | number | mongoose.Types.ObjectId) {
  const items = await SaleItem.find({ saleId: toObjectId(saleId) }).lean();

  return items.map((item) => ({
    ...item,
    id: item._id.toString(),
    unitPrice: String(item.unitPrice),
    totalPrice: String(item.totalPrice),
  })) as any[];
}

export async function getTodaySales(userId: string | number | mongoose.Types.ObjectId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = await Sale.aggregate([
    {
      $match: {
        userId: toUserId(userId),
        createdAt: { $gte: today, $lt: tomorrow },
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$totalAmount" },
        saleCount: { $sum: 1 },
      },
    },
  ]);

  return {
    totalSales: result[0]?.totalSales ?? 0,
    saleCount: result[0]?.saleCount ?? 0,
  };
}

// ==================== CUSTOMER FUNCTIONS ====================

export type InsertCustomer = {
  userId: string | number | mongoose.Types.ObjectId;
  name: string;
  phone?: string | null;
  totalDebt?: number | string;
};

export type Customer = ICustomer & { id: number | string };

export async function createCustomer(customer: InsertCustomer) {
  const newCustomer = new Customer({
    userId: toUserId(customer.userId),
    name: customer.name,
    phone: customer.phone ?? null,
    totalDebt: typeof customer.totalDebt === "string" ? parseFloat(customer.totalDebt) : customer.totalDebt ?? 0,
  });

  const saved = await newCustomer.save();
  return saved._id.toString();
}

export async function getCustomersByUser(userId: string | number | mongoose.Types.ObjectId) {
  const customers = await Customer.find({ userId: toUserId(userId) })
    .sort({ updatedAt: -1 })
    .lean();

  return customers.map((c) => ({
    ...c,
    id: c._id.toString(),
    totalDebt: String(c.totalDebt),
  })) as any[];
}

export async function getCustomerById(id: string | number, userId: string | number | mongoose.Types.ObjectId) {
  const customer = await Customer.findOne({
    _id: toObjectId(id),
    userId: toUserId(userId),
  }).lean();

  if (!customer) return undefined;

  return {
    ...customer,
    id: customer._id.toString(),
    totalDebt: String(customer.totalDebt),
  } as any;
}

export async function getCustomerByName(name: string, userId: string | number | mongoose.Types.ObjectId) {
  const customer = await Customer.findOne({
    name,
    userId: toUserId(userId),
  }).lean();

  if (!customer) return undefined;

  return {
    ...customer,
    id: customer._id.toString(),
    totalDebt: String(customer.totalDebt),
  } as any;
}

export async function updateCustomerDebt(customerId: string | number | mongoose.Types.ObjectId, amount: number) {
  await Customer.updateOne(
    { _id: toObjectId(customerId) },
    { $inc: { totalDebt: amount } }
  );
}

export async function getCustomersWithDebt(userId: string | number | mongoose.Types.ObjectId) {
  const customers = await Customer.find({
    userId: toUserId(userId),
    totalDebt: { $gt: 0 },
  })
    .sort({ totalDebt: -1 })
    .lean();

  return customers.map((c) => ({
    ...c,
    id: c._id.toString(),
    totalDebt: String(c.totalDebt),
  })) as any[];
}

export async function payDebt(customerId: string | number | mongoose.Types.ObjectId, userId: string | number | mongoose.Types.ObjectId, amount: number) {
  await Customer.updateOne(
    { _id: toObjectId(customerId), userId: toUserId(userId) },
    { $inc: { totalDebt: -amount }, $min: { totalDebt: 0 } }
  );
}

// ==================== CHAT LOG FUNCTIONS ====================

export type InsertChatLog = {
  userId: string | number | mongoose.Types.ObjectId;
  role: "user" | "assistant";
  content: string;
};

export type ChatLog = IChatLog & { id: number | string };

export async function createChatLog(log: InsertChatLog) {
  const newLog = new ChatLog({
    userId: toUserId(log.userId),
    role: log.role,
    content: log.content,
  });

  await newLog.save();
}

export async function getChatLogs(userId: string | number | mongoose.Types.ObjectId, limit = 20) {
  const logs = await ChatLog.find({ userId: toUserId(userId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return logs.map((log) => ({
    ...log,
    id: log._id.toString(),
  })) as any[];
}

// ==================== ANALYTICS FUNCTIONS ====================

export async function getAnalytics(userId: string | number | mongoose.Types.ObjectId) {
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

export async function getDailySales(userId: string | number | mongoose.Types.ObjectId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const result = await Sale.aggregate([
    {
      $match: {
        userId: toUserId(userId),
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        totalAmount: { $sum: "$totalAmount" },
        saleCount: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  return result.map((r) => ({
    date: r._id,
    totalAmount: r.totalAmount,
    saleCount: r.saleCount,
  }));
}

export async function getMonthlySales(userId: string | number | mongoose.Types.ObjectId, months = 6) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const result = await Sale.aggregate([
    {
      $match: {
        userId: toUserId(userId),
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        monthName: { $first: { $dateToString: { format: "%b %Y", date: "$createdAt" } } },
        totalAmount: { $sum: "$totalAmount" },
        saleCount: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  return result.map((r) => ({
    month: r._id,
    monthName: r.monthName,
    totalAmount: r.totalAmount,
    saleCount: r.saleCount,
  }));
}

export async function getTopSellingProducts(userId: string | number | mongoose.Types.ObjectId, limit = 5) {
  const result = await SaleItem.aggregate([
    {
      $lookup: {
        from: "sales",
        localField: "saleId",
        foreignField: "_id",
        as: "sale",
      },
    },
    {
      $unwind: "$sale",
    },
    {
      $match: {
        "sale.userId": toUserId(userId),
      },
    },
    {
      $group: {
        _id: { productId: "$productId", productName: "$productName" },
        totalQuantity: { $sum: "$quantity" },
        totalRevenue: { $sum: "$totalPrice" },
      },
    },
    {
      $sort: { totalQuantity: -1 },
    },
    {
      $limit: limit,
    },
  ]);

  return result.map((r) => ({
    productId: r._id.productId.toString(),
    productName: r._id.productName,
    totalQuantity: r.totalQuantity,
    totalRevenue: r.totalRevenue,
  }));
}

export async function getSalesSummary(userId: string | number | mongoose.Types.ObjectId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Start of week (Monday)
  const weekStart = new Date(today);
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);

  // Start of month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todayResult, weekResult, monthResult] = await Promise.all([
    Sale.aggregate([
      {
        $match: {
          userId: toUserId(userId),
          createdAt: { $gte: today, $lt: tomorrow },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" },
          saleCount: { $sum: 1 },
        },
      },
    ]),
    Sale.aggregate([
      {
        $match: {
          userId: toUserId(userId),
          createdAt: { $gte: weekStart },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" },
          saleCount: { $sum: 1 },
        },
      },
    ]),
    Sale.aggregate([
      {
        $match: {
          userId: toUserId(userId),
          createdAt: { $gte: monthStart },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" },
          saleCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    today: {
      totalAmount: todayResult[0]?.totalAmount ?? 0,
      saleCount: todayResult[0]?.saleCount ?? 0,
    },
    thisWeek: {
      totalAmount: weekResult[0]?.totalAmount ?? 0,
      saleCount: weekResult[0]?.saleCount ?? 0,
    },
    thisMonth: {
      totalAmount: monthResult[0]?.totalAmount ?? 0,
      saleCount: monthResult[0]?.saleCount ?? 0,
    },
  };
}

// ==================== RECEIPT FUNCTIONS ====================

export async function getReceiptData(saleId: string | number | mongoose.Types.ObjectId) {
  const sale = await Sale.findById(toObjectId(saleId)).lean();
  if (!sale) throw new Error("Sale not found");

  const items = await SaleItem.find({ saleId: toObjectId(saleId) }).lean();

  let customerName = "ลูกค้าทั่วไป";
  if (sale.customerId) {
    const customer = await Customer.findById(sale.customerId).lean();
    if (customer) {
      customerName = customer.name;
    }
  }

  return {
    saleId: sale._id.toString(),
    date: sale.createdAt,
    customerName,
    items: items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      totalPrice: String(item.totalPrice),
    })),
    totalAmount: sale.totalAmount,
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
    day: "2-digit",
  });
  const timeStr = date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
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
