import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ShiftControlProps {
  /**
   * Context where this component is used
   * - "sell": Show warning dialog that blocks selling if no open shift
   * - "reports": Just show open/close button, no blocking
   */
  context?: "sell" | "reports";
}

export default function ShiftControl({ context = "reports" }: ShiftControlProps) {
  // ตรวจสอบกะวันนี้
  const { data: todayShift } = trpc.shift.today.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Derived state: มีกะเปิดอยู่หรือไม่
  const hasOpenShift = todayShift?.status === "open";

  // State สำหรับ dialog เตือนกะ (ใช้เฉพาะใน context="sell")
  const [showShiftWarning, setShowShiftWarning] = useState(false);

  // State สำหรับเปิดกะ
  const [showOpenShiftDialog, setShowOpenShiftDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState<string>("");

  // State สำหรับปิดกะ
  const [showCloseShiftDialog, setShowCloseShiftDialog] = useState(false);
  const [closingCash, setClosingCash] = useState<string>("");
  const [closeSummary, setCloseSummary] = useState<{
    openingCash: number;
    closingCash: number;
    expectedCash: number;
    actualCash: number;
    cashDifference: number;
    totalSales: number;
    cashSales: number;
    creditSales: number;
    saleCount: number;
    startTime: Date;
    endTime: Date;
  } | null>(null);

  const utils = trpc.useUtils();

  // Mutation สำหรับเปิดกะ
  const openShift = trpc.shift.open.useMutation({
    onSuccess: () => {
      toast.success("เปิดรอบกะสำเร็จ");
      setShowOpenShiftDialog(false);
      setShowShiftWarning(false);
      setOpeningCash("0");
      // Refetch shift.today เพื่ออัปเดตสถานะ
      utils.shift.today.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "เกิดข้อผิดพลาดในการเปิดกะ");
    },
  });

  // Mutation สำหรับปิดกะ
  const closeShift = trpc.shift.close.useMutation({
    onSuccess: (data) => {
      toast.success("ปิดรอบกะสำเร็จ");
      // เก็บ summary เพื่อแสดงใน dialog
      setCloseSummary(data.summary);
    },
    onError: (error) => {
      toast.error(error.message || "เกิดข้อผิดพลาดในการปิดกะ");
    },
  });

  // ตรวจสอบสถานะกะและแสดง dialog เตือนถ้าจำเป็น (เฉพาะ context="sell")
  useEffect(() => {
    if (context !== "sell") return;

    // รอให้ query เสร็จก่อน (todayShift อาจเป็น undefined ระหว่าง loading)
    if (todayShift === undefined) return;

    // ถ้ามีกะเปิดอยู่ → ปิด dialog ทั้งหมด
    if (hasOpenShift) {
      setShowShiftWarning(false);
      setShowOpenShiftDialog(false);
      return;
    }

    // ถ้าไม่มีกะ หรือกะปิดแล้ว → แสดง dialog เตือน
    if (todayShift === null || todayShift.status === "closed") {
      setShowShiftWarning(true);
    }
  }, [todayShift, hasOpenShift, context]);

  // ข้อความเตือนตามสถานะ
  const getShiftWarningMessage = () => {
    if (todayShift === undefined) {
      return "";
    }

    if (todayShift === null) {
      return "ยังไม่ได้เปิดกะวันนี้";
    }

    if (todayShift.status === "closed") {
      return "กะวันนี้ปิดไปแล้ว";
    }

    return "กรุณาเปิดรอบกะก่อนเริ่มขาย";
  };

  // Handler สำหรับเปิด dialog เปิดกะ
  const handleOpenShiftClick = () => {
    setShowShiftWarning(false);
    setShowOpenShiftDialog(true);
  };

  // Handler สำหรับยืนยันเปิดกะ
  const handleConfirmOpenShift = () => {
    const cashValue = parseFloat(openingCash);

    // Validate
    if (isNaN(cashValue) || cashValue < 0) {
      toast.error("กรุณาใส่จำนวนเงินสดที่ถูกต้อง (ต้องเป็นตัวเลข >= 0)");
      return;
    }

    // เรียก API
    openShift.mutate({ openingCash: cashValue });
  };

  // Handler สำหรับปิดกะ
  const handleCloseShift = () => {
    const cashValue = parseFloat(closingCash);

    // Validate
    if (isNaN(cashValue) || cashValue < 0) {
      toast.error("กรุณาใส่จำนวนเงินสดที่ถูกต้อง (ต้องเป็นตัวเลข >= 0)");
      return;
    }

    // Reset summary ก่อนเรียก API
    setCloseSummary(null);

    // เรียก API
    closeShift.mutate({ closingCash: cashValue });
  };

  // Handler สำหรับยืนยันปิดกะ (หลังแสดง summary)
  const handleConfirmCloseShift = () => {
    setShowCloseShiftDialog(false);
    setClosingCash("");
    setCloseSummary(null);
    // Refetch shift.today เพื่ออัปเดตสถานะ
    utils.shift.today.invalidate();
  };

  return (
    <>
      {/* Shift Warning Dialog (เฉพาะ context="sell") */}
      {context === "sell" && (
        <Dialog open={showShiftWarning} onOpenChange={setShowShiftWarning}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-xl">กรุณาเปิดรอบกะก่อนเริ่มขาย</DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <p className="text-center text-muted-foreground">
                {getShiftWarningMessage()}
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowShiftWarning(false)}
                className="flex-1"
              >
                ปิด
              </Button>
              <Button
                className="ts-btn-primary flex-1"
                onClick={handleOpenShiftClick}
              >
                เปิดกะ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Close Shift Dialog */}
      <Dialog open={showCloseShiftDialog} onOpenChange={setShowCloseShiftDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">ปิดรอบกะ</DialogTitle>
          </DialogHeader>

          {!closeSummary ? (
            // Step 1: ใส่เงินสดที่นับได้จริง
            <>
              <div className="py-4 space-y-4">
                <p className="text-center text-muted-foreground">
                  กรุณาใส่เงินสดที่นับได้จริงในลิ้นชัก
                </p>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    เงินสดที่นับได้จริง (บาท)
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={closingCash}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        setClosingCash(value);
                      }
                    }}
                    placeholder=""
                    className="ts-input text-lg text-center"
                    autoFocus
                    disabled={closeShift.isPending}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCloseShiftDialog(false);
                    setClosingCash("");
                  }}
                  className="flex-1"
                  disabled={closeShift.isPending}
                >
                  ยกเลิก
                </Button>
                <Button
                  className="ts-btn-primary flex-1"
                  onClick={handleCloseShift}
                  disabled={closeShift.isPending || !closingCash.trim()}
                >
                  {closeShift.isPending ? (
                    <>กำลังคำนวณ...</>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      คำนวณ / ปิดกะ
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            // Step 2: แสดง Summary
            <>
              <div className="py-4 space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-lg mb-3">สรุปการขาย</h3>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">ยอดขายรวม</p>
                      <p className="text-lg font-bold text-primary">
                        ฿{closeSummary.totalSales.toLocaleString("th-TH")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">จำนวนรายการ</p>
                      <p className="text-lg font-bold">
                        {closeSummary.saleCount} รายการ
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">เงินสด</span>
                      <span className="font-semibold">
                        ฿{closeSummary.cashSales.toLocaleString("th-TH")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ขายเชื่อ</span>
                      <span className="font-semibold">
                        ฿{closeSummary.creditSales.toLocaleString("th-TH")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-lg mb-3">เงินสด</h3>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">เงินเปิดกะ</span>
                      <span className="font-semibold">
                        ฿{closeSummary.openingCash.toLocaleString("th-TH")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">เงินสดที่ควรมี</span>
                      <span className="font-semibold">
                        ฿{closeSummary.expectedCash.toLocaleString("th-TH")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">เงินสดจริง</span>
                      <span className="font-semibold">
                        ฿{closeSummary.actualCash.toLocaleString("th-TH")}
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between items-center">
                      <span className="font-semibold">
                        {closeSummary.cashDifference >= 0 ? "เงินเกิน" : "เงินขาด"}
                      </span>
                      <span
                        className={`text-xl font-bold ${
                          closeSummary.cashDifference >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {closeSummary.cashDifference >= 0 ? "+" : ""}
                        ฿{Math.abs(closeSummary.cashDifference).toLocaleString("th-TH")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  className="ts-btn-primary flex-1"
                  onClick={handleConfirmCloseShift}
                >
                  <Check className="w-5 h-5" />
                  ยืนยันปิดกะ
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Open Shift Dialog */}
      <Dialog open={showOpenShiftDialog} onOpenChange={setShowOpenShiftDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">เปิดรอบกะ</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <p className="text-center text-muted-foreground">
              กรุณาใส่เงินสดตั้งต้นก่อนเริ่มขาย
            </p>

            <div>
              <label className="block text-sm font-medium mb-2">
                เงินสดตั้งต้นในลิ้นชัก (บาท)
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={openingCash}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || /^\d*\.?\d*$/.test(value)) {
                    setOpeningCash(value);
                  }
                }}
                placeholder=""
                className="ts-input text-lg text-center"
                autoFocus
                disabled={openShift.isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowOpenShiftDialog(false);
                setOpeningCash("0");
              }}
              className="flex-1"
              disabled={openShift.isPending}
            >
              ยกเลิก
            </Button>
            <Button
              className="ts-btn-primary flex-1"
              onClick={handleConfirmOpenShift}
              disabled={openShift.isPending}
            >
              {openShift.isPending ? (
                <>กำลังเปิดกะ...</>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  ยืนยันเปิดกะ
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Control Button สำหรับ Reports page */}
      {context === "reports" && (
        <div className="mb-4 flex justify-end">
          {hasOpenShift ? (
            <Button
              variant="outline"
              onClick={() => setShowCloseShiftDialog(true)}
            >
              ปิดกะ
            </Button>
          ) : (
            <Button
              className="ts-btn-primary"
              onClick={() => setShowOpenShiftDialog(true)}
            >
              เปิดกะ
            </Button>
          )}
        </div>
      )}

      {/* Control Button สำหรับ Sell page header */}
      {context === "sell" && hasOpenShift && (
        <Button
          variant="outline"
          size="sm"
          className="text-primary-foreground border-primary-foreground/30 hover:bg-white/20"
          onClick={() => setShowCloseShiftDialog(true)}
        >
          ปิดกะ
        </Button>
      )}
    </>
  );
}
