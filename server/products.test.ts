import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  getProductsByUser: vi.fn().mockResolvedValue([
    { id: 1, userId: 1, name: "ปุ๋ยยูเรีย", price: "350.00", stock: 10, minStock: 5 },
    { id: 2, userId: 1, name: "ยาฆ่าแมลง", price: "120.00", stock: 3, minStock: 5 },
  ]),
  getLowStockProducts: vi.fn().mockResolvedValue([
    { id: 2, userId: 1, name: "ยาฆ่าแมลง", price: "120.00", stock: 3, minStock: 5 },
  ]),
  createProduct: vi.fn().mockResolvedValue(3),
  updateProduct: vi.fn().mockResolvedValue(undefined),
  deleteProduct: vi.fn().mockResolvedValue(undefined),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("products router", () => {
  it("lists products for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.products.list();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("ปุ๋ยยูเรีย");
  });

  it("returns low stock products", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.products.lowStock();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("ยาฆ่าแมลง");
    expect(result[0].stock).toBeLessThanOrEqual(result[0].minStock);
  });

  it("creates a new product", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.products.create({
      name: "เมล็ดพันธุ์ข้าว",
      price: "250.00",
      stock: 20,
      minStock: 10,
    });

    expect(result).toHaveProperty("id");
    expect(result.id).toBe(3);
  });

  it("updates a product", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.products.update({
      id: 1,
      name: "ปุ๋ยยูเรีย (ใหม่)",
      price: "380.00",
    });

    expect(result).toEqual({ success: true });
  });

  it("deletes a product", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.products.delete({ id: 1 });

    expect(result).toEqual({ success: true });
  });
});
