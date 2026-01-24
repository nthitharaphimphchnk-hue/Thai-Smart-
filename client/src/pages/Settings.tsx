import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Save, AlertCircle, CheckCircle2, Store, MapPin, CreditCard } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Settings() {
  const [sellerName, setSellerName] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [sellerTaxId, setSellerTaxId] = useState("");

  // ดึงข้อมูล settings ปัจจุบัน
  const { data: settings, isLoading } = trpc.system.settings.get.useQuery();

  // อัปเดต settings
  const updateSettings = trpc.system.settings.update.useMutation({
    onSuccess: () => {
      toast.success("บันทึกข้อมูลร้านสำเร็จ");
    },
    onError: (error) => {
      toast.error(error.message || "เกิดข้อผิดพลาดในการบันทึก");
    },
  });

  // โหลดข้อมูลเมื่อ settings เปลี่ยน
  useEffect(() => {
    if (settings) {
      setSellerName(settings.sellerName || "");
      setSellerAddress(settings.sellerAddress || "");
      setSellerTaxId(settings.sellerTaxId || "");
    }
  }, [settings]);

  // Validate sellerTaxId (ต้องเป็นตัวเลข 13 หลัก)
  const validateTaxId = (taxId: string): boolean => {
    // ลบช่องว่างและขีดออก
    const cleaned = taxId.replace(/\s|-/g, "");
    // ตรวจสอบว่าเป็นตัวเลข 13 หลัก
    return /^\d{13}$/.test(cleaned);
  };

  // Format sellerTaxId (XXX-XXXX-XXXX-X)
  const formatTaxId = (value: string): string => {
    // ลบทุกอย่างที่ไม่ใช่ตัวเลข
    const numbers = value.replace(/\D/g, "");
    // จำกัด 13 หลัก
    const limited = numbers.slice(0, 13);
    // Format: XXX-XXXX-XXXX-X
    if (limited.length <= 3) return limited;
    if (limited.length <= 7) return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    if (limited.length <= 11) return `${limited.slice(0, 3)}-${limited.slice(3, 7)}-${limited.slice(7)}`;
    return `${limited.slice(0, 3)}-${limited.slice(3, 7)}-${limited.slice(7, 11)}-${limited.slice(11)}`;
  };

  const handleTaxIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTaxId(e.target.value);
    setSellerTaxId(formatted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!sellerName.trim()) {
      toast.error("กรุณากรอกชื่อร้าน");
      return;
    }

    if (!sellerAddress.trim()) {
      toast.error("กรุณากรอกที่อยู่ร้าน");
      return;
    }

    if (!sellerTaxId.trim()) {
      toast.error("กรุณากรอกเลขประจำตัวผู้เสียภาษี");
      return;
    }

    // ตรวจสอบว่า sellerTaxId เป็นตัวเลข 13 หลัก
    if (!validateTaxId(sellerTaxId)) {
      toast.error("เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก");
      return;
    }

    // บันทึกข้อมูล
    updateSettings.mutate({
      sellerName: sellerName.trim(),
      sellerAddress: sellerAddress.trim(),
      sellerTaxId: sellerTaxId.replace(/\s|-/g, ""), // บันทึกเป็นตัวเลขล้วน
    });
  };

  // ตรวจสอบว่าข้อมูลครบถ้วนหรือไม่
  const isComplete =
    sellerName.trim() &&
    sellerAddress.trim() &&
    sellerTaxId.trim() &&
    validateTaxId(sellerTaxId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-secondary text-secondary-foreground p-4 flex items-center gap-4">
        <Link href="/">
          <Button
            variant="ghost"
            size="icon"
            className="text-secondary-foreground hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1">ตั้งค่าข้อมูลร้าน</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              ข้อมูลผู้ขาย (สำหรับใบกำกับภาษีเต็ม)
            </CardTitle>
            <CardDescription>
              กรอกข้อมูลร้านให้ครบถ้วนเพื่อออกใบกำกับภาษีเต็มได้
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Status Alert */}
              {isComplete ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">ข้อมูลครบถ้วน</AlertTitle>
                  <AlertDescription className="text-green-700">
                    ข้อมูลร้านครบถ้วนแล้ว สามารถออกใบกำกับภาษีเต็มได้
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>ข้อมูลยังไม่ครบ</AlertTitle>
                  <AlertDescription>
                    กรุณากรอกข้อมูลให้ครบถ้วนทุกช่องเพื่อออกใบกำกับภาษีเต็มได้
                  </AlertDescription>
                </Alert>
              )}

              {/* ชื่อร้าน */}
              <div className="space-y-2">
                <Label htmlFor="sellerName" className="flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  ชื่อร้าน <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="sellerName"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="เช่น ร้านขายของชำ ABC"
                  required
                  className="ts-input"
                />
                <p className="text-xs text-muted-foreground">
                  ชื่อร้านที่ใช้ในใบกำกับภาษีเต็ม
                </p>
              </div>

              {/* ที่อยู่ร้าน */}
              <div className="space-y-2">
                <Label htmlFor="sellerAddress" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  ที่อยู่ร้าน <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="sellerAddress"
                  value={sellerAddress}
                  onChange={(e) => setSellerAddress(e.target.value)}
                  placeholder="เช่น 123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองตัน กรุงเทพมหานคร 10110"
                  required
                  rows={3}
                  className="ts-input"
                />
                <p className="text-xs text-muted-foreground">
                  ที่อยู่ร้านที่ใช้ในใบกำกับภาษีเต็ม
                </p>
              </div>

              {/* เลขประจำตัวผู้เสียภาษี */}
              <div className="space-y-2">
                <Label htmlFor="sellerTaxId" className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  เลขประจำตัวผู้เสียภาษีร้าน <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="sellerTaxId"
                  value={sellerTaxId}
                  onChange={handleTaxIdChange}
                  placeholder="123-4567-8901-2"
                  required
                  maxLength={17} // XXX-XXXX-XXXX-X = 17 ตัวอักษร
                  className="ts-input font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  ต้องเป็นตัวเลข 13 หลัก (เช่น 1234567890123)
                </p>
                {sellerTaxId && !validateTaxId(sellerTaxId) && (
                  <p className="text-xs text-red-500">
                    ⚠️ เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex gap-2 justify-end pt-4">
                <Link href="/">
                  <Button type="button" variant="outline">
                    ยกเลิก
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={updateSettings.isPending || !isComplete}
                  className="min-w-[120px]"
                >
                  {updateSettings.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      บันทึก
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-4 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm text-blue-800">
              <p className="font-semibold">💡 หมายเหตุ:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>ข้อมูลนี้จะใช้ในใบกำกับภาษีเต็มทุกใบ</li>
                <li>สามารถแก้ไขได้ตลอดเวลา</li>
                <li>เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก</li>
                <li>ข้อมูลจะถูกบันทึกอัตโนมัติเมื่อกด "บันทึก"</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
