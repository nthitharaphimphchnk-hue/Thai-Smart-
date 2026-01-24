import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { playBeep, playOutOfStockBeep } from "@/lib/sound";
import { ArrowLeft, Plus, Minus, ShoppingCart, Trash2, CreditCard, Banknote, Check, Printer } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import PrintReceipt from "./PrintReceipt";
import ShiftControl from "@/components/ShiftControl";

const VAT_RATE = 0.07;

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
}

interface SaleResponse {
  saleId: string;
  totalAmount: number;
}

export default function Sell() {
  const [, setLocation] = useLocation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");
  const [customerName, setCustomerName] = useState("");
  const [useVat, setUseVat] = useState(false);
  const [showPrintReceipt, setShowPrintReceipt] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [receiptText, setReceiptText] = useState("");

  const { data: products, isLoading } = trpc.products.list.useQuery();
  const { data: receiptData } = trpc.receipts.generate.useQuery(
    { saleId: lastSaleId || "" },
    { enabled: !!lastSaleId }
  );
  
  // ดึง settings (สำหรับ VAT)
  const { data: settings } = trpc.system.settings.get.useQuery();
  const vatEnabled = settings?.vatEnabled === true;
  
  // ตรวจสอบกะวันนี้ (สำหรับแสดงปุ่มปิดกะใน header)
  const { data: todayShift } = trpc.shift.today.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  
  // Derived state: มีกะเปิดอยู่หรือไม่
  const hasOpenShift = todayShift?.status === "open";
  
  const utils = trpc.useUtils();

  const createSale = trpc.sales.create.useMutation({
    onSuccess: (data: SaleResponse) => {
      toast.success(`ขายสำเร็จ! ยอดรวม ${data.totalAmount.toLocaleString()} บาท`);
      setLastSaleId(data.saleId);
      setCart([]);
      setShowCheckout(false);
      setCustomerName("");
      setPaymentType("cash");
      setUseVat(false); // Reset VAT toggle
    },
    onError: () => {
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่");
    },
  });

  const filteredProducts = products?.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: { id: string; name: string; price: string }) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
        },
      ];
    });
  };

  const handleBarcodeScan = async () => {
    if (!barcodeInput.trim()) return;

    const barcode = barcodeInput.trim();
    setBarcodeInput(""); // Clear input immediately for next scan

    try {
      const product = await utils.products.byBarcode.fetch({ barcode });
      
      if (product) {
        if (product.stock <= 0) {
          playOutOfStockBeep();
          toast.error("สินค้าหมด");
          setTimeout(() => {
            barcodeInputRef.current?.focus();
          }, 100);
          return;
        }
        
        addToCart({
          id: String(product.id),
          name: product.name,
          price: product.price,
        });
        playBeep();
        toast.success(`เพิ่ม ${product.name} ลงตะกร้าแล้ว`);
        // Auto focus กลับไปที่ input
        setTimeout(() => {
          barcodeInputRef.current?.focus();
        }, 100);
      } else {
        toast.error("ไม่พบสินค้าที่มีบาร์โค้ดนี้");
        setTimeout(() => {
          barcodeInputRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      toast.error("ไม่พบสินค้าที่มีบาร์โค้ดนี้");
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    }
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBarcodeScan();
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
    0
  );

  // Calculate VAT breakdown
  const subtotal = totalAmount;
  const vatAmount = useVat ? subtotal * VAT_RATE : 0;
  const totalWithVat = subtotal + vatAmount;

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error("กรุณาเลือกสินค้าก่อน");
      return;
    }
    setShowCheckout(true);
  };

  const handleConfirmSale = () => {
    if (paymentType === "credit" && !customerName.trim()) {
      toast.error("กรุณาใส่ชื่อลูกค้า");
      return;
    }

    createSale.mutate({
      items: cart,
      paymentType,
      customerName: paymentType === "credit" ? customerName : undefined,
      vatRate: vatEnabled ? VAT_RATE : (useVat ? VAT_RATE : 0),
    });
  };

  const focusBarcodeInput = () => {
    barcodeInputRef.current?.focus();
  };

  // ใช้ receiptData เมื่อมีข้อมูล
  if (receiptData && !receiptText && receiptData.receiptText) {
    setReceiptText(receiptData.receiptText);
  }

  useEffect(() => {
    if (receiptText && lastSaleId) {
      // เปิด dialog พิมพ์ใบเสร็จอัตโนมัติ
      setShowPrintReceipt(true);
    }
  }, [receiptText, lastSaleId]);

  // Sync VAT toggle with settings
  useEffect(() => {
    if (vatEnabled) {
      setUseVat(true);
    }
  }, [vatEnabled]);


  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Shift Control Component - Handles dialogs and warning */}
      <ShiftControl context="sell" />

      {/* Print Receipt Dialog */}
      <Dialog open={showPrintReceipt} onOpenChange={setShowPrintReceipt}>
        <DialogContent className="max-w-sm max-h-screen overflow-y-auto">
          {receiptText && (
            <PrintReceipt
              receiptText={receiptText}
              saleId={lastSaleId || ""}
              onClose={() => {
                setShowPrintReceipt(false);
                setLastSaleId(null);
                setReceiptText("");
                focusBarcodeInput();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/20">
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1">ขายของ</h1>
        <div className="flex items-center gap-2">
          {/* ปุ่มปิดกะจาก ShiftControl - render ใน header */}
          <ShiftControl context="sell" />
          <div className="relative">
            <ShoppingCart className="w-6 h-6" />
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-secondary text-secondary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Barcode Scanner */}
      <div className="p-4 bg-card border-b border-border">
        <Input
          ref={barcodeInputRef}
          placeholder="ยิงบาร์โค้ดสินค้า..."
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.target.value)}
          onKeyDown={handleBarcodeKeyDown}
          className="ts-input"
          autoFocus
        />
      </div>

      {/* Search */}
      <div className="p-4 bg-card border-b border-border">
        <Input
          placeholder="ค้นหาสินค้า..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="ts-input"
        />
      </div>

      {/* Product List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
        ) : filteredProducts?.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">ไม่พบสินค้า</p>
            <Link href="/products">
              <Button variant="outline">เพิ่มสินค้าใหม่</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts?.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="ts-card text-left hover:border-primary transition-colors"
              >
                <h3 className="font-semibold text-lg truncate">{product.name}</h3>
                <p className="text-primary font-bold text-xl">
                  ฿{parseFloat(product.price).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  คงเหลือ: {product.stock} ชิ้น
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart Summary */}
      {cart.length > 0 && (
        <div className="bg-card border-t border-border p-4">
          <div className="max-h-40 overflow-y-auto mb-4">
            {cart.map((item) => (
              <div key={item.productId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex-1">
                  <p className="font-medium truncate">{item.productName}</p>
                  <p className="text-sm text-muted-foreground">
                    ฿{parseFloat(item.unitPrice).toLocaleString()} x {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-8 h-8"
                    onClick={() => updateQuantity(item.productId, -1)}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-8 text-center font-bold">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-8 h-8"
                    onClick={() => updateQuantity(item.productId, 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-destructive"
                    onClick={() => removeFromCart(item.productId)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold">รวมทั้งหมด</span>
            <span className="text-2xl font-bold text-primary">
              ฿{totalAmount.toLocaleString()}
            </span>
          </div>
          
          <div className="flex gap-2">
            <Button
              className="ts-btn-primary flex-1"
              onClick={handleCheckout}
            >
              <ShoppingCart className="w-5 h-5" />
              ชำระเงิน
            </Button>
            {receiptText && (
              <Button
                variant="outline"
                className="px-4"
                onClick={() => setShowPrintReceipt(true)}
              >
                <Printer className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">พิมพ์ใบเสร็จ</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">เลือกวิธีชำระเงิน</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Summary Section */}
            <div className="space-y-2">
              {useVat ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ราคาก่อน VAT</span>
                    <span>฿{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT 7%</span>
                    <span>฿{vatAmount.toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">รวมทั้งสิ้น</span>
                      <span className="text-2xl font-bold text-primary">
                        ฿{totalWithVat.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-muted-foreground mb-1">ยอดรวม</p>
                  <p className="text-3xl font-bold text-primary">
                    ฿{totalAmount.toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* VAT Toggle */}
            <div
              className={`flex flex-col gap-3 p-4 rounded-lg border-2 transition-all ${
                useVat
                  ? "bg-yellow-50 border-yellow-400"
                  : "bg-gray-100 border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium ${
                      useVat ? "text-yellow-800" : "text-gray-500"
                    }`}
                  >
                    คิด VAT 7%
                  </span>
                  {vatEnabled && (
                    <span className="text-xs text-muted-foreground">(บังคับใช้ทั้งร้าน)</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!vatEnabled) {
                      setUseVat(!useVat);
                    }
                  }}
                  disabled={vatEnabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    useVat ? "bg-primary" : "bg-gray-300"
                  } ${vatEnabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                      useVat
                        ? "translate-x-6 bg-white"
                        : "translate-x-1 bg-gray-100"
                    }`}
                  />
                </button>
              </div>
              {/* Status Message */}
              <div
                className={`text-xs ${
                  useVat ? "text-yellow-800" : "text-gray-500"
                }`}
              >
                {useVat
                  ? "บิลนี้จะคิด VAT 7% และออกภาษี"
                  : "บิลนี้ไม่คิด VAT"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setPaymentType("cash")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  paymentType === "cash"
                    ? "border-primary bg-primary/10"
                    : "border-border"
                }`}
              >
                <Banknote className="w-8 h-8 mx-auto mb-2" />
                <p className="font-semibold">เงินสด</p>
              </button>
              <button
                onClick={() => setPaymentType("credit")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  paymentType === "credit"
                    ? "border-primary bg-primary/10"
                    : "border-border"
                }`}
              >
                <CreditCard className="w-8 h-8 mx-auto mb-2" />
                <p className="font-semibold">ขายเชื่อ</p>
              </button>
            </div>

            {paymentType === "credit" && (
              <Input
                placeholder="ชื่อลูกค้า"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="ts-input"
              />
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCheckout(false)}
              className="flex-1"
            >
              ยกเลิก
            </Button>
            <Button
              className="ts-btn-primary flex-1"
              onClick={handleConfirmSale}
              disabled={createSale.isPending}
            >
              {createSale.isPending ? (
                <>กำลังบันทึก...</>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  ยืนยัน
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
