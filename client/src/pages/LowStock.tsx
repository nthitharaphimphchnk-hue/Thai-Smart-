import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Package, AlertTriangle, Plus } from "lucide-react";
import { Link } from "wouter";

export default function LowStock() {
  const { data: products, isLoading } = trpc.products.lowStock.useQuery();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-ts-warning text-ts-black p-4 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="text-ts-black hover:bg-black/10">
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1">ของใกล้หมด</h1>
        <Package className="w-6 h-6" />
      </header>

      {/* Content */}
      <main className="flex-1 p-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
        ) : products?.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto mb-4 text-ts-success" />
            <h2 className="text-xl font-semibold mb-2">สินค้าพร้อมขาย!</h2>
            <p className="text-muted-foreground">ไม่มีสินค้าใกล้หมดในขณะนี้</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="ts-card bg-ts-warning/10 border-ts-warning">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-ts-warning" />
                <div>
                  <p className="font-semibold">มี {products?.length} รายการใกล้หมด</p>
                  <p className="text-sm text-muted-foreground">ควรสั่งซื้อเพิ่มเร็วๆ นี้</p>
                </div>
              </div>
            </div>

            {products?.map((product) => (
              <div key={product.id} className="ts-card">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      ราคา: ฿{parseFloat(product.price).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${
                      product.stock <= 0 ? 'text-ts-danger' : 
                      'text-ts-warning'
                    }`}>
                      {product.stock}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      จุดสั่งซื้อ: {(product as any).reorderPoint ?? product.minStock ?? 5}
                    </p>
                  </div>
                </div>
                
                {product.stock <= 0 && (
                  <div className="mt-3 p-2 bg-ts-danger/10 rounded-lg text-center">
                    <p className="text-ts-danger font-semibold text-sm">หมดสต็อก!</p>
                  </div>
                )}
              </div>
            ))}

            {/* Suggestion Card */}
            <div className="ts-card bg-muted mt-6">
              <h3 className="font-semibold mb-2">💡 แนะนำ</h3>
              <p className="text-sm text-muted-foreground">
                ลองถาม AI ว่า "พรุ่งนี้ต้องซื้ออะไร" เพื่อดูรายการสินค้าที่ควรสั่งซื้อเพิ่ม
              </p>
              <Link href="/chat">
                <Button variant="outline" className="mt-3 w-full">
                  คุยกับ AI
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Action */}
      <div className="p-4 bg-card border-t border-border">
        <Link href="/products">
          <Button className="ts-btn-primary w-full">
            <Plus className="w-5 h-5" />
            จัดการสินค้า
          </Button>
        </Link>
      </div>
    </div>
  );
}
