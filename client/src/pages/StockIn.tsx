import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { toast } from "sonner";

export default function StockIn() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();

  const { data: products, isLoading } = trpc.products.list.useQuery();

  const initialProductId = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("productId") ?? "";
  }, [search]);

  const [productId, setProductId] = useState<string>(initialProductId);
  const [quantity, setQuantity] = useState<number>(1);
  const [note, setNote] = useState<string>("");

  const selectedProduct = useMemo(
    () => products?.find((p) => String(p.id) === productId),
    [products, productId]
  );

  const stockInMutation = trpc.stock.in.useMutation({
    onSuccess: async () => {
      toast.success("บันทึกรับสินค้าเข้าสำเร็จ");
      await utils.products.list.invalidate();
      await utils.products.lowStock.invalidate();
      await utils.stock.movements.invalidate();
      setLocation("/products");
    },
    onError: (err) => {
      toast.error(err.message || "เกิดข้อผิดพลาด");
    },
  });

  const handleSubmit = () => {
    if (!productId) {
      toast.error("กรุณาเลือกสินค้า");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("จำนวนต้องมากกว่า 0");
      return;
    }
    stockInMutation.mutate({
      productId,
      quantity,
      note: note.trim() || undefined,
    });
  };

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
        <h1 className="text-xl font-bold flex-1">รับสินค้าเข้า</h1>
        <PackagePlus className="w-6 h-6" />
      </header>

      <main className="flex-1 p-4 space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
        ) : (
          <>
            <div className="ts-card space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">เลือกสินค้า</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  <option value="">-- เลือกสินค้า --</option>
                  {products?.map((p) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div className="text-sm text-muted-foreground">
                  คงเหลือปัจจุบัน:{" "}
                  <span className="font-semibold text-foreground">
                    {selectedProduct.stock}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">จำนวนรับเข้า</label>
                <Input
                  inputMode="numeric"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">หมายเหตุ (ไม่บังคับ)</label>
                <Input
                  placeholder="เช่น รับของจากตลาดเช้า"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            <Button
              className="ts-btn-primary w-full"
              onClick={handleSubmit}
              disabled={stockInMutation.isPending}
            >
              บันทึก
            </Button>
          </>
        )}
      </main>
    </div>
  );
}

