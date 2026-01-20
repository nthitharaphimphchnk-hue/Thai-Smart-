import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("reports router", () => {
  it("should have summary procedure", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    // Test that the procedure exists and returns expected structure
    const result = await caller.reports.summary();
    
    expect(result).toHaveProperty("today");
    expect(result).toHaveProperty("thisWeek");
    expect(result).toHaveProperty("thisMonth");
    expect(result.today).toHaveProperty("totalAmount");
    expect(result.today).toHaveProperty("saleCount");
  });

  it("should have daily procedure", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.reports.daily();
    
    expect(Array.isArray(result)).toBe(true);
  });

  it("should have monthly procedure", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.reports.monthly();
    
    expect(Array.isArray(result)).toBe(true);
  });

  it("should have topProducts procedure", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.reports.topProducts();
    
    expect(Array.isArray(result)).toBe(true);
  });
});
