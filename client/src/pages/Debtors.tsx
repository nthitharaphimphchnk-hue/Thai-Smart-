import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Users, Banknote, Check } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Debtors() {
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: number;
    name: string;
    totalDebt: string;
  } | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const { data: customers, isLoading, refetch } = trpc.customers.withDebt.useQuery();
  const payDebt = trpc.customers.payDebt.useMutation({
    onSuccess: () => {
      toast.success("บันทึกการชำระเงินสำเร็จ");
      setShowPayDialog(false);
      setPayAmount("");
      setSelectedCustomer(null);
      refetch();
    },
    onError: () => {
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่");
    },
  });

  const totalDebt = customers?.reduce(
    (sum, c) => sum + parseFloat(c.totalDebt as string),
    0
  ) || 0;

  const handlePayClick = (customer: { id: number; name: string; totalDebt: string }) => {
    setSelectedCustomer(customer);
    setPayAmount(customer.totalDebt);
    setShowPayDialog(true);
  };

  const handleConfirmPay = () => {
    if (!selectedCustomer || !payAmount) return;
    
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("กรุณาใส่จำนวนเงินที่ถูกต้อง");
      return;
    }

    payDebt.mutate({
      customerId: selectedCustomer.id,
      amount,
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-ts-danger text-white p-4 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1">ลูกค้าค้างเงิน</h1>
        <Users className="w-6 h-6" />
      </header>

      {/* Summary */}
      <div className="bg-card p-4 border-b border-border">
        <div className="text-center">
          <p className="text-muted-foreground text-sm">ยอดค้างรวมทั้งหมด</p>
          <p className="text-3xl font-bold text-ts-danger">
            ฿{totalDebt.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            จาก {customers?.length || 0} ราย
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
        ) : customers?.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 mx-auto mb-4 text-ts-success" />
            <h2 className="text-xl font-semibold mb-2">ไม่มีลูกหนี้!</h2>
            <p className="text-muted-foreground">ลูกค้าทุกคนชำระเงินครบแล้ว</p>
          </div>
        ) : (
          <div className="space-y-3">
            {customers?.map((customer) => (
              <div key={customer.id} className="ts-card">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{customer.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      บันทึกเมื่อ: {new Date(customer.createdAt).toLocaleDateString('th-TH')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-ts-danger">
                      ฿{parseFloat(customer.totalDebt as string).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  className="w-full mt-3 border-ts-success text-ts-success hover:bg-ts-success hover:text-white"
                  onClick={() => handlePayClick({
                    id: customer.id,
                    name: customer.name,
                    totalDebt: customer.totalDebt as string,
                  })}
                >
                  <Banknote className="w-4 h-4 mr-2" />
                  รับชำระเงิน
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Pay Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">รับชำระเงิน</DialogTitle>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <p className="text-muted-foreground">ลูกค้า</p>
                <p className="text-xl font-bold">{selectedCustomer.name}</p>
              </div>
              
              <div className="text-center">
                <p className="text-muted-foreground">ยอดค้างชำระ</p>
                <p className="text-2xl font-bold text-ts-danger">
                  ฿{parseFloat(selectedCustomer.totalDebt).toLocaleString()}
                </p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  จำนวนเงินที่รับ
                </label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="ts-input text-center text-xl font-bold"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPayDialog(false)}
              className="flex-1"
            >
              ยกเลิก
            </Button>
            <Button
              className="ts-btn-primary flex-1 bg-ts-success hover:bg-ts-success/90"
              onClick={handleConfirmPay}
              disabled={payDebt.isPending}
            >
              <Check className="w-5 h-5" />
              {payDebt.isPending ? "กำลังบันทึก..." : "ยืนยัน"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
