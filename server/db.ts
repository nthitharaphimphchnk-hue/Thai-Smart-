import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ENV } from "./_core/env";
import { User, IUser } from "./models/User";
import { Product, IProduct } from "./models/Product";
import { Sale, ISale } from "./models/Sale";
import { SaleItem, ISaleItem } from "./models/SaleItem";
import { Customer, ICustomer } from "./models/Customer";
import { ChatLog, IChatLog } from "./models/ChatLog";
import { Settings, ISettings } from "./models/Settings";
import {
  StockMovement,
  type IStockMovement,
  type StockMovementSource,
  type StockMovementType,
} from "./models/StockMovement";
import { Shift, IShift } from "./models/Shift";
import { FullTaxInvoice, IFullTaxInvoice } from "./models/FullTaxInvoice";

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

// Public user shape used across server/client (tRPC). Keep it as a plain object (not a Mongoose Document).
export type User = {
  id: string | number;
  openId?: string | null;
  email?: string | null;
  password?: string | null;
  name?: string | null;
  loginMethod?: string | null;
  role: "user" | "admin";
  createdAt?: Date;
  updatedAt?: Date;
  lastSignedIn?: Date;
};

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
    } as unknown as User;
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
    } as unknown as User;
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
    // Mongoose's `readyState` typing can be overly strict across versions; treat it as numeric states.
    if ((mongoose.default.connection.readyState as number) !== 1) {
      console.warn("[Database] MongoDB not connected, attempting to reconnect...");
      const { connectMongoDB } = await import("./mongodb");
      await connectMongoDB();
      
      // Check again after reconnect
      if ((mongoose.default.connection.readyState as number) !== 1) {
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
    } as unknown as User;
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
  reorderPoint?: number;
  minStock?: number; // legacy alias
  barcode?: string | null;
  imageUrl?: string | null;
};

export type Product = IProduct & { id: number | string };

export async function createProduct(product: InsertProduct) {
  const reorderPoint =
    product.reorderPoint ?? product.minStock ?? 5;
  const newProduct = new Product({
    userId: toUserId(product.userId),
    name: product.name,
    price: typeof product.price === "string" ? parseFloat(product.price) : product.price,
    stock: product.stock ?? 0,
    reorderPoint,
    minStock: reorderPoint, // keep in sync for older UI/queries
    barcode: product.barcode ?? null,
    imageUrl: product.imageUrl ?? null,
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
    reorderPoint: product.reorderPoint ?? product.minStock ?? 5,
    minStock: product.reorderPoint ?? product.minStock ?? 5,
    imageUrl: product.imageUrl ?? null,
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
    reorderPoint: (p as any).reorderPoint ?? (p as any).minStock ?? 5,
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
    reorderPoint: (product as any).reorderPoint ?? (product as any).minStock ?? 5,
  } as any;
}

export async function getProductByBarcode(
  userId: string | number | mongoose.Types.ObjectId,
  barcode: string
) {
  const product = await Product.findOne({
    userId: toUserId(userId),
    barcode,
  }).lean();

  if (!product) return undefined;

  return {
    ...product,
    id: product._id.toString(),
    price: String(product.price),
    reorderPoint: (product as any).reorderPoint ?? (product as any).minStock ?? 5,
  } as any;
}

export async function updateProduct(id: string | number, userId: string | number | mongoose.Types.ObjectId, data: Partial<InsertProduct>) {
  const updateData: any = {};
  
  if (data.name !== undefined) updateData.name = data.name;
  if (data.price !== undefined) {
    updateData.price = typeof data.price === "string" ? parseFloat(data.price) : data.price;
  }
  if (data.stock !== undefined) updateData.stock = data.stock;
  const reorderPoint =
    data.reorderPoint ?? data.minStock;
  if (reorderPoint !== undefined) {
    updateData.reorderPoint = reorderPoint;
    updateData.minStock = reorderPoint; // keep in sync for older UI/queries
  }
  if (data.barcode !== undefined) updateData.barcode = data.barcode ?? null;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl ?? null;

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
    $expr: {
      $lte: [
        "$stock",
        { $ifNull: ["$reorderPoint", "$minStock"] },
      ],
    },
  })
    .sort({ stock: 1 })
    .lean();

  return products.map((p) => ({
    ...p,
    id: p._id.toString(),
    price: String(p.price),
    reorderPoint: (p as any).reorderPoint ?? (p as any).minStock ?? 5,
  })) as any[];
}

type AdjustStockInput = {
  productId: string | number;
  quantityChange: number; // positive = IN, negative = OUT
  source: StockMovementSource;
  note?: string | null;
};

export async function adjustProductStock(input: AdjustStockInput) {
  const { productId, quantityChange, source, note } = input;
  if (!Number.isFinite(quantityChange) || quantityChange === 0) {
    throw new Error("quantityChange must be a non-zero number");
  }

  const type: StockMovementType = quantityChange > 0 ? "IN" : "OUT";
  const quantity = Math.abs(quantityChange);

  // Prevent negative stock for OUT movements.
  const filter: any = { _id: toObjectId(productId) };
  if (quantityChange < 0) {
    filter.stock = { $gte: quantity };
  }

  const updatedProduct = await Product.findOneAndUpdate(
    filter,
    { $inc: { stock: quantityChange } },
    { new: true }
  ).lean();

  if (!updatedProduct) {
    if (quantityChange < 0) {
      throw new Error("สต็อกไม่พอสำหรับการขาย/ตัดสต็อก");
    }
    throw new Error("ไม่พบสินค้า");
  }

  await StockMovement.create({
    productId: toObjectId(productId),
    type,
    quantity,
    source,
    note: note ?? null,
  });

  return {
    ...updatedProduct,
    id: (updatedProduct as any)._id.toString(),
    price: String((updatedProduct as any).price),
    reorderPoint: (updatedProduct as any).reorderPoint ?? (updatedProduct as any).minStock ?? 5,
  } as any;
}

// Backward compatible helper used by existing code paths.
export async function updateProductStock(
  productId: string | number,
  quantityChange: number,
  source: StockMovementSource = "ADJUST",
  note?: string | null
) {
  await adjustProductStock({ productId, quantityChange, source, note });
}

export async function stockInPurchase(input: {
  productId: string | number;
  quantity: number;
  note?: string | null;
}) {
  const qty = Math.floor(input.quantity);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("จำนวนต้องมากกว่า 0");
  return adjustProductStock({
    productId: input.productId,
    quantityChange: qty,
    source: "PURCHASE",
    note: input.note ?? null,
  });
}

export async function getStockMovementsByUser(input: {
  userId: string | number | mongoose.Types.ObjectId;
  limit?: number;
  cursor?: string | null; // movement id
  productId?: string | number | null;
}) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

  const products = await Product.find({ userId: toUserId(input.userId) })
    .select({ _id: 1, name: 1 })
    .lean();

  const allowedProductIds = new Set(products.map((p) => p._id.toString()));
  const productNameById = new Map(products.map((p) => [p._id.toString(), p.name] as const));

  let productIdsForQuery: mongoose.Types.ObjectId[] = products.map((p) => p._id);
  if (input.productId) {
    const pid = String(input.productId);
    if (!allowedProductIds.has(pid)) return { items: [], nextCursor: null };
    productIdsForQuery = [toObjectId(pid)];
  }

  const filter: any = { productId: { $in: productIdsForQuery } };
  if (input.cursor) {
    filter._id = { $lt: toObjectId(input.cursor) };
  }

  const movements = await StockMovement.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasNext = movements.length > limit;
  const slice = hasNext ? movements.slice(0, limit) : movements;
  const nextCursor = hasNext ? slice[slice.length - 1]?._id.toString() : null;

  return {
    items: slice.map((m) => ({
      ...m,
      id: (m as any)._id.toString(),
      productName: productNameById.get((m as any).productId.toString()) ?? "ไม่ทราบชื่อสินค้า",
    })) as any[],
    nextCursor,
  };
}

// ==================== SALES FUNCTIONS ====================

export type InsertSale = {
  userId: string | number | mongoose.Types.ObjectId;
  customerId?: string | number | mongoose.Types.ObjectId | null;
  totalAmount: number | string;
  paymentType?: "cash" | "credit";
  vatRate?: number;
  vatAmount?: number;
  subtotal?: number;
  totalWithVat?: number;
};

export type Sale = ISale & { id: number | string };

export async function createSale(sale: InsertSale) {
  const newSale = new Sale({
    userId: toUserId(sale.userId),
    customerId: sale.customerId ? toObjectId(sale.customerId) : null,
    totalAmount: typeof sale.totalAmount === "string" ? parseFloat(sale.totalAmount) : sale.totalAmount,
    paymentType: sale.paymentType ?? "cash",
    vatRate: sale.vatRate ?? 0,
    vatAmount: sale.vatAmount ?? 0,
    subtotal: sale.subtotal ?? 0,
    totalWithVat: sale.totalWithVat ?? 0,
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

/**
 * ดึงรายการสินค้าที่ขายวันนี้ (group ตาม productName)
 * @returns Array of { productName, totalQuantity, totalAmount }
 */
export async function getTodaySoldItems(
  userId: string | number | mongoose.Types.ObjectId
): Promise<Array<{
  productName: string;
  totalQuantity: number;
  totalAmount: number;
}>> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // ดึง saleIds ของวันนี้
  const todaySales = await Sale.find({
    userId: toUserId(userId),
    createdAt: { $gte: today, $lt: tomorrow },
  })
    .select("_id")
    .lean();

  const saleIds = todaySales.map((s) => s._id);

  if (saleIds.length === 0) {
    return [];
  }

  // Aggregate SaleItem ตาม productName
  const result = await SaleItem.aggregate([
    {
      $match: {
        saleId: { $in: saleIds },
      },
    },
    {
      $group: {
        _id: "$productName",
        totalQuantity: { $sum: "$quantity" },
        totalAmount: { $sum: "$totalPrice" },
      },
    },
    {
      $project: {
        _id: 0,
        productName: "$_id",
        totalQuantity: 1,
        totalAmount: 1,
      },
    },
    {
      $sort: { totalAmount: -1 }, // เรียงตามยอดขายมากไปน้อย
    },
  ]);

  return result.map((item) => ({
    productName: item.productName,
    totalQuantity: item.totalQuantity,
    totalAmount: item.totalAmount,
  }));
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
          subtotal: { $sum: { $ifNull: ["$subtotal", 0] } },
          vatAmount: { $sum: { $ifNull: ["$vatAmount", 0] } },
          totalWithVat: { $sum: { $ifNull: ["$totalWithVat", 0] } },
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
          subtotal: { $sum: { $ifNull: ["$subtotal", 0] } },
          vatAmount: { $sum: { $ifNull: ["$vatAmount", 0] } },
          totalWithVat: { $sum: { $ifNull: ["$totalWithVat", 0] } },
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
          subtotal: { $sum: { $ifNull: ["$subtotal", 0] } },
          vatAmount: { $sum: { $ifNull: ["$vatAmount", 0] } },
          totalWithVat: { $sum: { $ifNull: ["$totalWithVat", 0] } },
          saleCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    today: {
      totalAmount: todayResult[0]?.totalAmount ?? 0,
      subtotal: todayResult[0]?.subtotal ?? 0,
      vatAmount: todayResult[0]?.vatAmount ?? 0,
      totalWithVat: todayResult[0]?.totalWithVat ?? 0,
      saleCount: todayResult[0]?.saleCount ?? 0,
    },
    thisWeek: {
      totalAmount: weekResult[0]?.totalAmount ?? 0,
      subtotal: weekResult[0]?.subtotal ?? 0,
      vatAmount: weekResult[0]?.vatAmount ?? 0,
      totalWithVat: weekResult[0]?.totalWithVat ?? 0,
      saleCount: weekResult[0]?.saleCount ?? 0,
    },
    thisMonth: {
      totalAmount: monthResult[0]?.totalAmount ?? 0,
      subtotal: monthResult[0]?.subtotal ?? 0,
      vatAmount: monthResult[0]?.vatAmount ?? 0,
      totalWithVat: monthResult[0]?.totalWithVat ?? 0,
      saleCount: monthResult[0]?.saleCount ?? 0,
    },
  };
}

// ==================== SHIFT FUNCTIONS ====================

/**
 * Helper function to normalize date to start of day (00:00:00)
 */
function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Get today's date normalized to start of day
 */
function getTodayDate(): Date {
  return normalizeDate(new Date());
}

export type InsertShift = {
  userId: string | number | mongoose.Types.ObjectId;
  shiftNumber: number;
  shiftDate: Date;
  startTime: Date;
  openingCash: number;
  expectedCash: number;
  totalSales: number;
  cashSales: number;
  creditSales: number;
  saleCount: number;
  status: "open" | "closed";
};

export type Shift = IShift & { id: string };

/**
 * Find open shift for today
 */
export async function getOpenShiftToday(
  userId: string | number | mongoose.Types.ObjectId
): Promise<Shift | null> {
  const today = getTodayDate();
  
  const shift = await Shift.findOne({
    userId: toUserId(userId),
    shiftDate: today,
    status: "open",
  }).lean();

  if (!shift) return null;

  return {
    ...shift,
    id: shift._id.toString(),
  } as Shift;
}

/**
 * Get latest shift for today (any status)
 */
export async function getTodayShift(
  userId: string | number | mongoose.Types.ObjectId
): Promise<Shift | null> {
  const today = getTodayDate();
  
  const shift = await Shift.findOne({
    userId: toUserId(userId),
    shiftDate: today,
  })
    .sort({ startTime: -1 })
    .lean();

  if (!shift) return null;

  return {
    ...shift,
    id: shift._id.toString(),
  } as Shift;
}

/**
 * Get max shift number for today
 */
export async function getMaxShiftNumberToday(
  userId: string | number | mongoose.Types.ObjectId
): Promise<number> {
  const today = getTodayDate();
  
  const result = await Shift.aggregate([
    {
      $match: {
        userId: toUserId(userId),
        shiftDate: today,
      },
    },
    {
      $group: {
        _id: null,
        maxShiftNumber: { $max: "$shiftNumber" },
      },
    },
  ]);

  return result[0]?.maxShiftNumber ?? 0;
}

/**
 * Create a new shift
 */
export async function createShift(shift: InsertShift): Promise<Shift> {
  const newShift = new Shift({
    userId: toUserId(shift.userId),
    shiftNumber: shift.shiftNumber,
    shiftDate: normalizeDate(shift.shiftDate),
    startTime: shift.startTime,
    openingCash: shift.openingCash,
    expectedCash: shift.expectedCash,
    totalSales: shift.totalSales,
    cashSales: shift.cashSales,
    creditSales: shift.creditSales,
    saleCount: shift.saleCount,
    status: shift.status,
  });

  const saved = await newShift.save();
  return {
    ...saved.toObject(),
    id: saved._id.toString(),
  } as Shift;
}

/**
 * Get sales summary for a shift period
 */
export async function getSalesSummaryForShift(
  userId: string | number | mongoose.Types.ObjectId,
  startTime: Date,
  endTime: Date
) {
  const [cashResult, creditResult, totalResult] = await Promise.all([
    // Cash sales
    Sale.aggregate([
      {
        $match: {
          userId: toUserId(userId),
          paymentType: "cash",
          createdAt: { $gte: startTime, $lt: endTime },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
    ]),
    // Credit sales
    Sale.aggregate([
      {
        $match: {
          userId: toUserId(userId),
          paymentType: "credit",
          createdAt: { $gte: startTime, $lt: endTime },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
    ]),
    // Total sales count
    Sale.countDocuments({
      userId: toUserId(userId),
      createdAt: { $gte: startTime, $lt: endTime },
    }),
  ]);

  const cashSales = cashResult[0]?.total ?? 0;
  const creditSales = creditResult[0]?.total ?? 0;
  const totalSales = cashSales + creditSales;
  const saleCount = totalResult;

  return {
    totalSales,
    cashSales,
    creditSales,
    saleCount,
  };
}

/**
 * Update shift to closed status
 */
export async function closeShift(
  shiftId: string | number | mongoose.Types.ObjectId,
  data: {
    endTime: Date;
    closingCash: number;
    expectedCash: number;
    actualCash: number;
    cashDifference: number;
    totalSales: number;
    cashSales: number;
    creditSales: number;
    saleCount: number;
    notes?: string | null;
  }
): Promise<Shift> {
  const updated = await Shift.findByIdAndUpdate(
    toObjectId(shiftId),
    {
      endTime: data.endTime,
      closingCash: data.closingCash,
      expectedCash: data.expectedCash,
      actualCash: data.actualCash,
      cashDifference: data.cashDifference,
      totalSales: data.totalSales,
      cashSales: data.cashSales,
      creditSales: data.creditSales,
      saleCount: data.saleCount,
      status: "closed",
      notes: data.notes ?? null,
    },
    { new: true }
  ).lean();

  if (!updated) throw new Error("Shift not found");

  return {
    ...updated,
    id: updated._id.toString(),
  } as Shift;
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
    // VAT fields (backward compatible)
    subtotal: (sale as any).subtotal ?? sale.totalAmount,
    vatRate: (sale as any).vatRate ?? 0,
    vatAmount: (sale as any).vatAmount ?? 0,
    totalWithVat: (sale as any).totalWithVat ?? sale.totalAmount,
  };
}

/**
 * Format receipt text optimized for 80mm thermal printer
 * Paper width: 80mm, printable area: ~72-76mm (32-42 characters per line)
 * Uses monospace layout with proper line wrapping for long product names
 */
export function formatReceiptText(receiptData: Awaited<ReturnType<typeof getReceiptData>>): string {
  const lines: string[] = [];
  
  // Constants for 80mm thermal printer
  const MAX_LINE_WIDTH = 42; // Maximum characters per line for 80mm paper
  const PRODUCT_NAME_WIDTH = 24; // Space for product name (allows wrapping)
  const QTY_WIDTH = 6; // Space for quantity
  const PRICE_WIDTH = 10; // Space for price (right-aligned)

  /**
   * Helper: Wrap long text to multiple lines
   */
  function wrapText(text: string, maxWidth: number): string[] {
    if (text.length <= maxWidth) return [text];
    const words = text.split(/\s+/);
    const result: string[] = [];
    let currentLine = "";
    
    for (const word of words) {
      if (currentLine.length + word.length + 1 <= maxWidth) {
        currentLine += (currentLine ? " " : "") + word;
      } else {
        if (currentLine) result.push(currentLine);
        // If single word is longer than maxWidth, break it
        if (word.length > maxWidth) {
          for (let i = 0; i < word.length; i += maxWidth) {
            result.push(word.substring(i, i + maxWidth));
          }
          currentLine = "";
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) result.push(currentLine);
    return result;
  }

  /**
   * Helper: Center text within line width
   */
  function centerText(text: string, width: number = MAX_LINE_WIDTH): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(padding) + text;
  }

  /**
   * Helper: Create separator line
   */
  function separator(char: string = "-"): string {
    return char.repeat(MAX_LINE_WIDTH);
  }

  // Header (centered)
  lines.push(separator("="));
  lines.push(centerText("THAI SMART POS"));
  
  // แสดง "ใบเสร็จรับเงิน / ใบกำกับอย่างย่อ" ถ้ามี VAT
  const vatRate = (receiptData as any).vatRate ?? 0;
  if (vatRate > 0) {
    lines.push(centerText("*** ใบเสร็จรับเงิน / ใบกำกับอย่างย่อ ***"));
  } else {
    lines.push(centerText("ใบเสร็จรับเงิน"));
  }
  
  lines.push(separator("="));
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
  lines.push(`วันที่: ${dateStr} ${timeStr}`);
  lines.push(`ลูกค้า: ${receiptData.customerName}`);
  lines.push("");

  // Items header
  lines.push(separator("-"));
  lines.push("สินค้า".padEnd(PRODUCT_NAME_WIDTH) + "จำนวน".padStart(QTY_WIDTH) + "ราคา".padStart(PRICE_WIDTH));
  lines.push(separator("-"));

  // Items with proper wrapping
  for (const item of receiptData.items) {
    const productNameLines = wrapText(item.productName, PRODUCT_NAME_WIDTH);
    const qty = String(item.quantity);
    const price = `฿${parseFloat(String(item.totalPrice)).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    
    // First line: product name + qty + price
    const firstLine = productNameLines[0].padEnd(PRODUCT_NAME_WIDTH) + 
                      qty.padStart(QTY_WIDTH) + 
                      price.padStart(PRICE_WIDTH);
    lines.push(firstLine);
    
    // Additional lines for wrapped product name (indented, no qty/price)
    for (let i = 1; i < productNameLines.length; i++) {
      lines.push(productNameLines[i]);
    }
  }

  lines.push(separator("-"));

  // Total with VAT breakdown (if applicable)
  // vatRate ถูกประกาศไว้แล้วในส่วน header
  const formatAmount = (amount: number) => {
    return `฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (vatRate > 0) {
    // มี VAT - แสดง breakdown
    const subtotal = (receiptData as any).subtotal ?? receiptData.totalAmount;
    const vatAmount = (receiptData as any).vatAmount ?? 0;
    const totalWithVat = (receiptData as any).totalWithVat ?? receiptData.totalAmount;

    // Format without ฿ symbol for cleaner alignment
    const formatNumber = (amount: number) => {
      return amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    lines.push(`รวมก่อน VAT      ${formatNumber(subtotal)}`);
    lines.push(`VAT ${(vatRate * 100).toFixed(0)}%            ${formatNumber(vatAmount)}`);
    lines.push(separator("-"));
    lines.push(`รวมทั้งสิ้น       ${formatNumber(totalWithVat)}`);
  } else {
    // ไม่มี VAT - แสดงยอดรวมปกติ
    const totalAmount = Math.round(receiptData.totalAmount);
    lines.push(`รวมทั้งสิ้น     ${formatAmount(totalAmount)}`);
  }
  lines.push("");

  // Payment method
  const paymentMethod = receiptData.paymentType === "credit" ? "ขายเชื่อ" : "เงินสด";
  lines.push(`วิธีชำระ: ${paymentMethod}`);

  lines.push("");
  lines.push(separator("="));
  lines.push(centerText("ขอบคุณที่ใช้บริการ"));
  lines.push(separator("="));
  lines.push(""); // Extra blank line for paper cutting

  return lines.join("\n");
}

/**
 * Format full tax invoice text (ใบกำกับภาษีเต็ม)
 * ใช้รูปแบบเรียบง่าย พิมพ์ได้จริง
 */
export function formatFullTaxInvoiceText(invoiceData: {
  invoiceNumber: string;
  issuedDate: Date;
  sellerName: string;
  sellerAddress: string;
  sellerTaxId: string;
  buyerName: string;
  buyerAddress: string;
  buyerTaxId?: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number | string;
    totalPrice: number | string;
  }>;
  subtotal: number;
  vatAmount: number;
  totalWithVat: number;
  status?: "issued" | "cancelled"; // เพิ่ม status
}): string {
  const lines: string[] = [];
  
  // Constants for 80mm thermal printer
  const MAX_LINE_WIDTH = 42;
  
  function centerText(text: string, width: number = MAX_LINE_WIDTH): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(padding) + text;
  }
  
  function separator(char: string = "-"): string {
    return char.repeat(MAX_LINE_WIDTH);
  }
  
  function formatAmount(amount: number): string {
    return amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  // Header
  lines.push(separator("="));
  lines.push(centerText("ใบกำกับภาษีเต็ม"));
  // แสดงสถานะ "ยกเลิก" ถ้า status === "cancelled"
  const status = invoiceData.status ?? "issued";
  if (status === "cancelled") {
    lines.push(centerText("*** ยกเลิกแล้ว ***"));
  }
  lines.push(separator("="));
  lines.push("");
  
  // ข้อมูลผู้ขาย
  lines.push("ข้อมูลผู้ขาย:");
  lines.push(`ชื่อ: ${invoiceData.sellerName}`);
  lines.push(`ที่อยู่: ${invoiceData.sellerAddress}`);
  lines.push(`เลขประจำตัวผู้เสียภาษี: ${invoiceData.sellerTaxId}`);
  lines.push("");
  
  // ข้อมูลผู้ซื้อ
  lines.push("ข้อมูลผู้ซื้อ:");
  lines.push(`ชื่อ: ${invoiceData.buyerName}`);
  lines.push(`ที่อยู่: ${invoiceData.buyerAddress}`);
  if (invoiceData.buyerTaxId) {
    lines.push(`เลขประจำตัวผู้เสียภาษี: ${invoiceData.buyerTaxId}`);
  }
  lines.push("");
  
  // ข้อมูลเอกสาร
  lines.push(separator("-"));
  lines.push(`เลขที่ใบกำกับภาษี: ${invoiceData.invoiceNumber}`);
  const date = new Date(invoiceData.issuedDate);
  const dateStr = date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  lines.push(`วันที่ออกเอกสาร: ${dateStr}`);
  lines.push(separator("-"));
  lines.push("");
  
  // รายการสินค้า
  lines.push("รายการสินค้า:");
  lines.push(separator("-"));
  lines.push("สินค้า".padEnd(24) + "จำนวน".padStart(6) + "ราคา".padStart(10));
  lines.push(separator("-"));
  
  for (const item of invoiceData.items) {
    const productName = item.productName.length > 24 
      ? item.productName.substring(0, 21) + "..." 
      : item.productName;
    const qty = String(item.quantity);
    const price = formatAmount(parseFloat(String(item.totalPrice)));
    
    lines.push(
      productName.padEnd(24) + 
      qty.padStart(6) + 
      price.padStart(10)
    );
  }
  
  lines.push(separator("-"));
  lines.push("");
  
  // สรุปภาษี
  lines.push("สรุปภาษี:");
  lines.push(`รวมก่อน VAT      ${formatAmount(invoiceData.subtotal)}`);
  lines.push(`VAT 7%            ${formatAmount(invoiceData.vatAmount)}`);
  lines.push(separator("-"));
  lines.push(`รวมทั้งสิ้น       ${formatAmount(invoiceData.totalWithVat)}`);
  lines.push("");
  
  // Footer
  lines.push(separator("="));
  lines.push(centerText("ขอบคุณที่ใช้บริการ"));
  lines.push(separator("="));
  lines.push(""); // Extra blank line for paper cutting
  
  return lines.join("\n");
}

// ==================== SETTINGS FUNCTIONS ====================

/**
 * ดึง settings (singleton - มีแค่ 1 record)
 * ถ้ายังไม่มี → สร้างใหม่ด้วย default values
 */
export async function getSettings(): Promise<ISettings> {
  // Try to find by singleton field first, then fallback to any document (for migration)
  let settings = await Settings.findOne({ singleton: "settings" }).lean();
  
  if (!settings) {
    // Check if there's an old document without singleton field (migration case)
    const oldSettings = await Settings.findOne().lean();
    if (oldSettings) {
      // Update old document to include singleton field
      await Settings.updateOne(
        { _id: oldSettings._id },
        { $set: { singleton: "settings" } }
      );
      settings = { ...oldSettings, singleton: "settings" } as any;
    } else {
      // สร้าง settings ใหม่ด้วย default values
      const newSettings = new Settings({
        singleton: "settings",
        vatEnabled: false,
      });
      await newSettings.save();
      settings = newSettings.toObject();
    }
  }
  
  return settings as ISettings;
}

/**
 * อัปเดต settings
 */
export async function updateSettings(updates: Partial<Pick<ISettings, "vatEnabled" | "sellerName" | "sellerAddress" | "sellerTaxId">>): Promise<ISettings> {
  // Ensure settings exists
  await getSettings();
  
  const updated = await Settings.findOneAndUpdate(
    { singleton: "settings" },
    { $set: updates },
    { new: true, upsert: true }
  ).lean();
  
  return updated as ISettings;
}

// ==================== FULL TAX INVOICE FUNCTIONS ====================

/**
 * สร้างเลขที่ใบกำกับภาษี (ไม่ซ้ำ, เรียงลำดับ, แยกตามร้าน)
 * Format: TAX-YYYY-NNNNNN (เช่น TAX-2026-000001)
 * - TAX = prefix
 * - YYYY = ปี (4 หลัก)
 * - NNNNNN = เลขลำดับ (6 หลัก, เริ่มจาก 000001)
 */
export async function generateInvoiceNumber(
  userId: string | number | mongoose.Types.ObjectId
): Promise<string> {
  const today = new Date();
  const year = today.getFullYear(); // YYYY
  
  // หาเลขที่ใบกำกับภาษีล่าสุดของปีนี้ (แยกตามร้าน)
  const prefix = `TAX-${year}-`;
  const lastInvoice = await FullTaxInvoice.findOne({
    userId: toUserId(userId),
    invoiceNumber: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` }, // Escape regex special chars
  })
    .sort({ invoiceNumber: -1 })
    .lean();
  
  let sequence = 1;
  if (lastInvoice) {
    // ดึงเลขลำดับจาก invoiceNumber (TAX-YYYY-NNNNNN)
    // ตัวอย่าง: TAX-2026-000001 → 1
    const match = lastInvoice.invoiceNumber.match(/^TAX-\d{4}-(\d+)$/);
    if (match && match[1]) {
      const lastSequence = parseInt(match[1], 10);
      sequence = lastSequence + 1;
    }
  }
  
  // Format: TAX-YYYY-000001 (6 หลัก)
  return `${prefix}${String(sequence).padStart(6, "0")}`;
}

/**
 * สร้างใบกำกับภาษีเต็ม
 */
export type InsertFullTaxInvoice = {
  userId: string | number | mongoose.Types.ObjectId;
  saleId: string | number | mongoose.Types.ObjectId;
  buyerName: string;
  buyerAddress: string;
  buyerTaxId?: string | null;
};

export async function createFullTaxInvoice(
  data: InsertFullTaxInvoice
): Promise<string> {
  // ตรวจสอบว่า Sale มี VAT หรือไม่
  const sale = await Sale.findById(toObjectId(data.saleId)).lean();
  if (!sale) {
    throw new Error("Sale not found");
  }
  
  const vatRate = (sale as any).vatRate ?? 0;
  if (vatRate <= 0) {
    throw new Error("Full tax invoice can only be created for sales with VAT");
  }
  
  // ตรวจสอบว่ามีใบกำกับภาษีเต็มอยู่แล้วหรือไม่
  const existing = await FullTaxInvoice.findOne({
    saleId: toObjectId(data.saleId),
  }).lean();
  
  if (existing) {
    throw new Error("บิลนี้มีใบกำกับภาษีเต็มอยู่แล้ว (1 บิล = 1 ใบกำกับภาษีเต็มเท่านั้น)");
  }
  
  // ดึงข้อมูลผู้ขายจาก Settings
  const settings = await getSettings();
  const missingFields: string[] = [];
  if (!settings.sellerName || !settings.sellerName.trim()) {
    missingFields.push("ชื่อร้าน");
  }
  if (!settings.sellerAddress || !settings.sellerAddress.trim()) {
    missingFields.push("ที่อยู่ร้าน");
  }
  if (!settings.sellerTaxId || !settings.sellerTaxId.trim()) {
    missingFields.push("เลขประจำตัวผู้เสียภาษี");
  }
  
  if (missingFields.length > 0) {
    throw new Error(
      `กรุณาตั้งค่าข้อมูลร้านก่อนออกใบกำกับภาษีเต็ม\nข้อมูลที่ยังขาด: ${missingFields.join(", ")}\n\nไปที่: ตั้งค่า > ข้อมูลร้าน`
    );
  }
  
  // สร้างเลขที่ใบกำกับภาษี
  const invoiceNumber = await generateInvoiceNumber(data.userId);
  
  // ดึงข้อมูล VAT จาก Sale
  const subtotal = (sale as any).subtotal ?? sale.totalAmount;
  const vatAmount = (sale as any).vatAmount ?? 0;
  const totalWithVat = (sale as any).totalWithVat ?? sale.totalAmount;
  
  // สร้าง FullTaxInvoice
  const newInvoice = new FullTaxInvoice({
    userId: toUserId(data.userId),
    saleId: toObjectId(data.saleId),
    invoiceNumber,
    sellerName: settings.sellerName,
    sellerAddress: settings.sellerAddress,
    sellerTaxId: settings.sellerTaxId,
    buyerName: data.buyerName,
    buyerAddress: data.buyerAddress,
    buyerTaxId: data.buyerTaxId ?? null,
    subtotal,
    vatAmount,
    totalWithVat,
    issuedDate: new Date(),
    status: "issued", // สถานะเริ่มต้น = ออกแล้ว
  });
  
  const saved = await newInvoice.save();
  return saved._id.toString();
}

/**
 * ยกเลิกใบกำกับภาษีเต็ม
 * - ห้ามลบจากระบบ
 * - ต้องยังคงเลขที่เอกสาร
 * - เปลี่ยนสถานะเป็น "cancelled"
 */
export async function cancelFullTaxInvoice(
  invoiceId: string | number | mongoose.Types.ObjectId,
  userId: string | number | mongoose.Types.ObjectId
): Promise<void> {
  const invoice = await FullTaxInvoice.findOne({
    _id: toObjectId(invoiceId),
    userId: toUserId(userId),
  });

  if (!invoice) {
    throw new Error("ไม่พบใบกำกับภาษีเต็ม");
  }

  if (invoice.status === "cancelled") {
    throw new Error("ใบกำกับภาษีเต็มนี้ถูกยกเลิกไปแล้ว");
  }

  // เปลี่ยนสถานะเป็น cancelled (ไม่ลบข้อมูล)
  invoice.status = "cancelled";
  await invoice.save();
}

/**
 * ดึงใบกำกับภาษีเต็มจาก saleId
 */
export async function getFullTaxInvoiceBySaleId(
  saleId: string | number | mongoose.Types.ObjectId
) {
  const invoice = await FullTaxInvoice.findOne({
    saleId: toObjectId(saleId),
  }).lean();
  
  if (!invoice) return undefined;
  
  return {
    ...invoice,
    id: invoice._id.toString(),
    saleId: invoice.saleId.toString(),
    userId: invoice.userId.toString(),
  } as any;
}

/**
 * ดึงข้อมูล Sale พร้อม VAT สำหรับสร้างใบกำกับภาษีเต็ม
 */
export async function getSaleForFullTaxInvoice(
  saleId: string | number | mongoose.Types.ObjectId
) {
  const sale = await Sale.findById(toObjectId(saleId)).lean();
  if (!sale) return undefined;
  
  const vatRate = (sale as any).vatRate ?? 0;
  if (vatRate <= 0) {
    return undefined; // ไม่มี VAT → ไม่สามารถออกใบกำกับภาษีเต็มได้
  }
  
  const items = await SaleItem.find({ saleId: toObjectId(saleId) }).lean();
  
  return {
    saleId: sale._id.toString(),
    date: sale.createdAt,
    items: items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })),
    subtotal: (sale as any).subtotal ?? sale.totalAmount,
    vatRate,
    vatAmount: (sale as any).vatAmount ?? 0,
    totalWithVat: (sale as any).totalWithVat ?? sale.totalAmount,
    totalAmount: sale.totalAmount,
    paymentType: sale.paymentType,
  };
}

/**
 * ดึงรายการใบกำกับภาษีเต็ม (สำหรับบัญชี/ตรวจสอบ)
 */
export async function getFullTaxInvoices(
  userId: string | number | mongoose.Types.ObjectId,
  limit = 50
) {
  const invoices = await FullTaxInvoice.find({
    userId: toUserId(userId),
  })
    .sort({ issuedDate: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  return invoices.map((invoice) => ({
    ...invoice,
    id: invoice._id.toString(),
    saleId: invoice.saleId.toString(),
    userId: invoice.userId.toString(),
  })) as any[];
}
