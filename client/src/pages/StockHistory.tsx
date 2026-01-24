import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, History } from "lucide-react";
import { Link } from "wouter";

export default function StockHistory() {
  // STEP 1: keyword สำหรับค้นหาชื่อสินค้า
  const [keyword, setKeyword] = useState("");

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.stock.movements.useInfiniteQuery(
      { limit: 50 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      }
    );

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data]
  );

  // STEP 1: filter รายการตามชื่อสินค้า (ค้นหาแบบ contains, ไม่สนใจตัวพิมพ์เล็ก/ใหญ่)
  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => (m.productName ?? "").toLowerCase().includes(q));
  }, [items, keyword]);

  // STEP 2: แยกข้อมูลเป็น 2 กลุ่ม (ไม่แตะ backend)
  const inItems = useMemo(
    () => filteredItems.filter((m) => m.type === "IN"),
    [filteredItems]
  );

  const saleItems = useMemo(
    () => filteredItems.filter((m) => m.type === "OUT" && m.source === "SALE"),
    [filteredItems]
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-secondary text-secondary-foreground p-4 flex items-center gap-4">
        <Link href="/products">
          <Button
            variant="ghost"
            size="icon"
            className="text-secondary-foreground hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1">ประวัติสต็อก</h1>
        <History className="w-6 h-6" />
      </header>

      <main className="flex-1 p-4 space-y-3">
        {/* STEP 1: ช่องค้นหาสินค้า */}
        <div className="ts-card">
          <Input
            placeholder="ค้นหาชื่อสินค้า..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="ts-input"
          />
          <div className="mt-2 text-xs text-muted-foreground">
            ค้นหาจากชื่อสินค้าในรายการที่โหลดมาแล้ว
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
        ) : (
          <>
            {/* STEP 2: 2 คอลัมน์ (ซ้าย=IN, ขวา=SALE) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              {/* ซ้าย: สต็อกเข้า */}
              <section className="space-y-3">
                <div className="ts-card border border-ts-success/30">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-ts-success">
                      สต็อกเข้า (IN)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {inItems.length} รายการ
                    </div>
                  </div>
                </div>

                {inItems.length === 0 ? (
                  <div className="ts-card text-center text-muted-foreground py-8">
                    {keyword.trim()
                      ? "ไม่พบรายการสต็อกเข้าที่ตรงกับคำค้นหา"
                      : "ยังไม่มีรายการสต็อกเข้า"}
                  </div>
                ) : (
                  inItems.map((m) => (
                    <div key={m.id} className="ts-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-semibold">{m.productName}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(m.createdAt).toLocaleString("th-TH")}
                            {m.note ? ` • ${m.note}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-ts-success">
                            +{m.quantity}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {m.source}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </section>

              {/* ขวา: ขายออก */}
              <section className="space-y-3">
                <div className="ts-card border border-ts-danger/30">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-ts-danger">
                      สต็อกออก (ขาย) (SALE)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {saleItems.length} รายการ
                    </div>
                  </div>
                </div>

                {saleItems.length === 0 ? (
                  <div className="ts-card text-center text-muted-foreground py-8">
                    {keyword.trim()
                      ? "ไม่พบรายการขายออกที่ตรงกับคำค้นหา"
                      : "ยังไม่มีรายการขายออก"}
                  </div>
                ) : (
                  saleItems.map((m) => (
                    <div key={m.id} className="ts-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-semibold">{m.productName}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(m.createdAt).toLocaleString("th-TH")}
                            {m.note ? ` • ${m.note}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-ts-danger">
                            -{m.quantity}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {m.source}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </section>
            </div>

            {/* ปุ่มโหลดเพิ่มยังคงโหลดรวม แล้วค่อยแยกฝั่งใน UI */}
            {hasNextPage && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "กำลังโหลด..." : "โหลดเพิ่ม"}
              </Button>
            )}
          </>
        )}
      </main>
    </div>
  );
}

