import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, FileText, Printer, AlertCircle, Settings, XCircle, Ban, Download } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { receiptPrinter } from "@/lib/receiptPrinter";

interface FullTaxInvoiceDialogProps {
  saleId: string | number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
}

export default function FullTaxInvoiceDialog({
  saleId,
  open,
  onOpenChange,
  onClose,
}: FullTaxInvoiceDialogProps) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerTaxId, setBuyerTaxId] = useState("");
  const [step, setStep] = useState<"form" | "view">("form");

  // ตรวจสอบว่ามีใบกำกับภาษีเต็มอยู่แล้วหรือไม่
  const { data: invoiceExists } = trpc.fullTaxInvoice.checkExists.useQuery(
    { saleId },
    { enabled: !!open }
  );

  // ดึงข้อมูล Settings เพื่อตรวจสอบข้อมูลผู้ขาย
  const { data: settings } = trpc.system.settings.get.useQuery(undefined, {
    enabled: !!open && step === "form",
  });

  // ตรวจสอบว่าข้อมูลผู้ขายครบหรือไม่
  const isSellerInfoComplete = !!(
    settings?.sellerName &&
    settings?.sellerName.trim() &&
    settings?.sellerAddress &&
    settings?.sellerAddress.trim() &&
    settings?.sellerTaxId &&
    settings?.sellerTaxId.trim()
  );

  // ดึงข้อมูล Sale เพื่อตรวจสอบว่ามี VAT หรือไม่ (เฉพาะตอน form)
  const { data: saleData, isLoading: isLoadingSale } = trpc.fullTaxInvoice.getSaleData.useQuery(
    { saleId },
    { enabled: !!open && step === "form" && invoiceExists === false && isSellerInfoComplete, retry: false }
  );

  // ดึงใบกำกับภาษีเต็ม (ถ้ามีอยู่แล้ว)
  const { data: invoiceData, refetch: refetchInvoice } = trpc.fullTaxInvoice.get.useQuery(
    { saleId },
    { enabled: !!open && (step === "view" || invoiceExists === true) }
  );

  const createInvoice = trpc.fullTaxInvoice.create.useMutation({
    onSuccess: () => {
      toast.success("สร้างใบกำกับภาษีเต็มสำเร็จ");
      setStep("view");
      refetchInvoice();
    },
    onError: (error) => {
      // แสดง error message ที่เป็นมิตร
      const errorMessage = error.message || "เกิดข้อผิดพลาดในการสร้างใบกำกับภาษีเต็ม";
      
      // ถ้า error เกี่ยวกับการมีอยู่แล้ว → แสดงข้อความพิเศษ
      if (errorMessage.includes("already exists") || errorMessage.includes("มีอยู่แล้ว")) {
        toast.error("บิลนี้มีใบกำกับภาษีเต็มอยู่แล้ว", {
          duration: 5000,
        });
        // เปลี่ยนไป view mode ทันที
        setStep("view");
        refetchInvoice();
      } else {
        toast.error(errorMessage, {
          duration: 5000,
        });
      }
    },
  });

  // ยกเลิกใบกำกับภาษีเต็ม
  const cancelInvoice = trpc.fullTaxInvoice.cancel.useMutation({
    onSuccess: () => {
      toast.success("ยกเลิกใบกำกับภาษีเต็มสำเร็จ");
      refetchInvoice();
    },
    onError: (error) => {
      toast.error(error.message || "ไม่สามารถยกเลิกใบกำกับภาษีเต็มได้");
    },
  });

  const handleSubmit = () => {
    if (!buyerName.trim()) {
      toast.error("กรุณากรอกชื่อผู้ซื้อ");
      return;
    }
    if (!buyerAddress.trim()) {
      toast.error("กรุณากรอกที่อยู่ผู้ซื้อ");
      return;
    }

    createInvoice.mutate({
      saleId,
      buyerName: buyerName.trim(),
      buyerAddress: buyerAddress.trim(),
      buyerTaxId: buyerTaxId.trim() || null,
    });
  };

  const handlePrint = async () => {
    if (!invoiceData?.invoiceText) {
      toast.error("ไม่มีข้อมูลใบกำกับภาษีเต็ม");
      return;
    }

    // อนุญาตให้พิมพ์ได้แม้ยกเลิกแล้ว (แต่จะแสดงสถานะในเอกสาร)
    try {
      // ใช้ receiptPrinter เดียวกับใบเสร็จ
      // ต้องเชื่อมต่อเครื่องพิมพ์ก่อน (ผู้ใช้ต้องทำเอง)
      await receiptPrinter.printReceipt(invoiceData.invoiceText);
      toast.success("พิมพ์ใบกำกับภาษีเต็มสำเร็จ");
    } catch (error: any) {
      toast.error(error.message || "ไม่สามารถพิมพ์ได้ กรุณาเชื่อมต่อเครื่องพิมพ์ก่อน");
    }
  };

  const handleDownloadPDF = () => {
    if (!invoiceData?.invoiceText || !invoiceData?.invoiceData) {
      toast.error("ไม่มีข้อมูลใบกำกับภาษีเต็ม");
      return;
    }

    // ดึงข้อมูล sale items (ถ้ายังไม่มี)
    // ใช้ข้อมูลจาก invoiceData.invoiceData หรือ query ใหม่
    const saleData = invoiceData.saleData || null;
    
    // สร้าง HTML สำหรับ PDF
    const htmlContent = generatePDFHTML(invoiceData.invoiceData, invoiceData.invoiceText, saleData);
    
    // สร้าง Blob และดาวน์โหลด
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoiceData.invoiceData.invoiceNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // แสดง toast แนะนำให้พิมพ์เป็น PDF
    toast.info("ดาวน์โหลดไฟล์ HTML แล้ว กรุณาเปิดไฟล์และพิมพ์เป็น PDF (Ctrl+P หรือ Cmd+P)", {
      duration: 5000,
    });
  };

  // ฟังก์ชันสร้าง HTML สำหรับ PDF
  const generatePDFHTML = (invoiceData: any, invoiceText: string, saleData: any = null): string => {
    const status = invoiceData.status === "cancelled" ? "ยกเลิกแล้ว" : "ออกแล้ว";
    const statusColor = invoiceData.status === "cancelled" ? "#dc2626" : "#059669";
    
    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${invoiceData.invoiceNumber} - ใบกำกับภาษีเต็ม</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    body {
      font-family: 'Sarabun', 'TH Sarabun New', 'Angsana New', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #000;
      padding: 20px;
      max-width: 210mm;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: bold;
    }
    .status-badge {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 4px;
      font-weight: bold;
      margin-top: 10px;
      color: white;
      background-color: ${statusColor};
    }
    .invoice-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .info-section {
      flex: 1;
      margin-right: 20px;
    }
    .info-section:last-child {
      margin-right: 0;
    }
    .info-section h3 {
      margin-top: 0;
      font-size: 16px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
    }
    .info-row {
      margin: 5px 0;
    }
    .info-label {
      font-weight: bold;
      display: inline-block;
      min-width: 120px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .items-table th,
    .items-table td {
      border: 1px solid #000;
      padding: 8px;
      text-align: left;
    }
    .items-table th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    .items-table .text-right {
      text-align: right;
    }
    .items-table .text-center {
      text-align: center;
    }
    .summary {
      margin-top: 20px;
      text-align: right;
    }
    .summary-row {
      display: flex;
      justify-content: flex-end;
      margin: 5px 0;
    }
    .summary-label {
      min-width: 150px;
      text-align: right;
      padding-right: 10px;
    }
    .summary-value {
      min-width: 120px;
      text-align: right;
      font-weight: bold;
    }
    .total {
      border-top: 2px solid #000;
      padding-top: 10px;
      margin-top: 10px;
      font-size: 18px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .receipt-text {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      white-space: pre-wrap;
      background-color: #f9f9f9;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-top: 20px;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>ใบกำกับภาษีเต็ม</h1>
    <div class="status-badge">สถานะ: ${status}</div>
  </div>

  <div class="invoice-info">
    <div class="info-section">
      <h3>ข้อมูลผู้ขาย</h3>
      <div class="info-row"><span class="info-label">ชื่อ:</span> ${invoiceData.sellerName}</div>
      <div class="info-row"><span class="info-label">ที่อยู่:</span> ${invoiceData.sellerAddress}</div>
      <div class="info-row"><span class="info-label">เลขประจำตัวผู้เสียภาษี:</span> ${invoiceData.sellerTaxId}</div>
    </div>
    <div class="info-section">
      <h3>ข้อมูลผู้ซื้อ</h3>
      <div class="info-row"><span class="info-label">ชื่อ:</span> ${invoiceData.buyerName}</div>
      <div class="info-row"><span class="info-label">ที่อยู่:</span> ${invoiceData.buyerAddress}</div>
      ${invoiceData.buyerTaxId ? `<div class="info-row"><span class="info-label">เลขประจำตัวผู้เสียภาษี:</span> ${invoiceData.buyerTaxId}</div>` : ""}
    </div>
  </div>

  <div class="info-section">
    <h3>ข้อมูลเอกสาร</h3>
    <div class="info-row"><span class="info-label">เลขที่ใบกำกับภาษี:</span> ${invoiceData.invoiceNumber}</div>
    <div class="info-row"><span class="info-label">วันที่ออกเอกสาร:</span> ${new Date(invoiceData.issuedDate).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}</div>
  </div>

  ${saleData && saleData.items && saleData.items.length > 0 ? `
  <div class="info-section">
    <h3>รายการสินค้า</h3>
    <table class="items-table">
      <thead>
        <tr>
          <th>ลำดับ</th>
          <th>ชื่อสินค้า</th>
          <th class="text-center">จำนวน</th>
          <th class="text-right">ราคาต่อหน่วย</th>
          <th class="text-right">รวม</th>
        </tr>
      </thead>
      <tbody>
        ${saleData.items.map((item: any, index: number) => `
        <tr>
          <td>${index + 1}</td>
          <td>${item.productName}</td>
          <td class="text-center">${item.quantity}</td>
          <td class="text-right">฿${parseFloat(String(item.unitPrice)).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="text-right">฿${parseFloat(String(item.totalPrice)).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

  <div class="summary">
    <div class="summary-row">
      <span class="summary-label">ราคาก่อน VAT:</span>
      <span class="summary-value">฿${invoiceData.subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">VAT 7%:</span>
      <span class="summary-value">฿${invoiceData.vatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
    <div class="summary-row total">
      <span class="summary-label">รวมทั้งสิ้น:</span>
      <span class="summary-value">฿${invoiceData.totalWithVat.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
  </div>

  <div class="footer">
    <p>เอกสารนี้ถูกสร้างจากระบบ Thai Smart POS</p>
    <p>สถานะ: ${status} | วันที่สร้างเอกสาร: ${new Date().toLocaleString("th-TH")}</p>
  </div>

  <div class="receipt-text">
    <strong>รายละเอียดใบกำกับภาษีเต็ม (รูปแบบ Thermal Printer):</strong>
    <pre>${invoiceText}</pre>
  </div>
</body>
</html>`;
  };

  // ยกเลิกเอกสาร (เปลี่ยนสถานะเป็น "cancelled")
  const handleCancelInvoice = () => {
    if (!invoiceData?.invoiceId) {
      toast.error("ไม่มีข้อมูลใบกำกับภาษีเต็ม");
      return;
    }

    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการยกเลิกใบกำกับภาษีเต็มนี้?\n\nหมายเหตุ: การยกเลิกจะไม่ลบข้อมูล แต่จะเปลี่ยนสถานะเป็น \"ยกเลิก\" เท่านั้น")) {
      cancelInvoice.mutate({ invoiceId: invoiceData.invoiceId });
    }
  };

  // ปิด dialog และ reset state
  const handleCloseDialog = () => {
    setStep("form");
    setBuyerName("");
    setBuyerAddress("");
    setBuyerTaxId("");
    onOpenChange(false);
    if (onClose) {
      onClose();
    }
  };

  // ถ้ามีใบกำกับภาษีเต็มอยู่แล้ว → แสดงทันที
  useEffect(() => {
    if (invoiceExists && step === "form") {
      setStep("view");
    }
  }, [invoiceExists, step]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {step === "form" ? "ออกใบกำกับภาษีเต็ม" : "ใบกำกับภาษีเต็ม"}
          </DialogTitle>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4">
            {/* แสดงข้อความเตือนถ้าข้อมูลผู้ขายไม่ครบ */}
            {!isSellerInfoComplete && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>กรุณาตั้งค่าข้อมูลร้านก่อน</AlertTitle>
                <AlertDescription className="mt-2">
                  <p className="mb-2">เพื่อออกใบกำกับภาษีเต็ม ต้องตั้งค่าข้อมูลร้านให้ครบถ้วน:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {!settings?.sellerName?.trim() && <li>ชื่อร้าน</li>}
                    {!settings?.sellerAddress?.trim() && <li>ที่อยู่ร้าน</li>}
                    {!settings?.sellerTaxId?.trim() && <li>เลขประจำตัวผู้เสียภาษี</li>}
                  </ul>
                  <div className="mt-3">
                    <Link href="/settings">
                      <Button variant="outline" size="sm" className="w-full">
                        <Settings className="w-4 h-4 mr-2" />
                        ไปตั้งค่าข้อมูลร้าน
                      </Button>
                    </Link>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {isLoadingSale ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : saleData ? (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>หมายเหตุ:</strong> ใบกำกับภาษีเต็มจะออกได้เฉพาะบิลที่มี VAT เท่านั้น
                  </p>
                  <p className="text-sm text-blue-700 mt-2">
                    ยอดรวม: ฿{saleData.totalWithVat.toLocaleString("th-TH")} (รวม VAT 7%)
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="buyerName">
                      ชื่อผู้ซื้อ <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="buyerName"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="กรอกชื่อผู้ซื้อ"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="buyerAddress">
                      ที่อยู่ผู้ซื้อ <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="buyerAddress"
                      value={buyerAddress}
                      onChange={(e) => setBuyerAddress(e.target.value)}
                      placeholder="กรอกที่อยู่ผู้ซื้อ"
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="buyerTaxId">เลขประจำตัวผู้เสียภาษีผู้ซื้อ (ไม่บังคับ)</Label>
                    <Input
                      id="buyerTaxId"
                      value={buyerTaxId}
                      onChange={(e) => setBuyerTaxId(e.target.value)}
                      placeholder="กรอกเลขประจำตัวผู้เสียภาษี (ถ้ามี)"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={handleCloseDialog}>
                    ยกเลิก
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      createInvoice.isPending ||
                      !buyerName.trim() ||
                      !buyerAddress.trim() ||
                      !isSellerInfoComplete
                    }
                  >
                    {createInvoice.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        กำลังสร้าง...
                      </>
                    ) : (
                      "สร้างใบกำกับภาษีเต็ม"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                ไม่พบข้อมูลการขาย หรือบิลนี้ไม่มี VAT
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {invoiceData ? (
              <>
                {/* ข้อมูลใบกำกับภาษีเต็ม */}
                <div className={`border rounded-lg p-4 ${
                  invoiceData.invoiceData.status === "cancelled"
                    ? "bg-red-50 border-red-200"
                    : "bg-blue-50 border-blue-200"
                }`}>
                  <div className="space-y-2 text-sm">
                    {/* สถานะเอกสาร */}
                    {invoiceData.invoiceData.status === "cancelled" && (
                      <div className="mb-3 p-2 bg-red-100 border border-red-300 rounded text-center">
                        <p className="text-red-800 font-semibold">⚠️ ยกเลิกแล้ว</p>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className={`font-medium ${
                        invoiceData.invoiceData.status === "cancelled" ? "text-red-800" : "text-blue-800"
                      }`}>เลขที่ใบกำกับภาษี:</span>
                      <span className={`font-mono font-semibold ${
                        invoiceData.invoiceData.status === "cancelled" ? "text-red-900" : "text-blue-900"
                      }`}>
                        {invoiceData.invoiceNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`font-medium ${
                        invoiceData.invoiceData.status === "cancelled" ? "text-red-800" : "text-blue-800"
                      }`}>วันที่ออกเอกสาร:</span>
                      <span className={invoiceData.invoiceData.status === "cancelled" ? "text-red-900" : "text-blue-900"}>
                        {new Date(invoiceData.invoiceData.issuedDate).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`font-medium ${
                        invoiceData.invoiceData.status === "cancelled" ? "text-red-800" : "text-blue-800"
                      }`}>ยอดรวม:</span>
                      <span className={`font-semibold ${
                        invoiceData.invoiceData.status === "cancelled" ? "text-red-900" : "text-blue-900"
                      }`}>
                        ฿{invoiceData.invoiceData.totalWithVat.toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Preview ใบกำกับภาษีเต็ม */}
                <div className="bg-white border-2 border-gray-300 rounded-lg p-4">
                  <div className="mx-auto" style={{ width: "288px", maxWidth: "100%" }}>
                    <pre
                      className="text-[10px] font-mono whitespace-pre-wrap break-words leading-tight"
                      style={{
                        fontFamily: "'Courier New', 'Courier', monospace",
                        letterSpacing: "0.5px",
                        lineHeight: "1.3",
                        wordBreak: "break-word",
                      }}
                    >
                      {invoiceData.invoiceText}
                    </pre>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={handleCloseDialog}>
                    ปิด
                  </Button>
                  {invoiceData.invoiceData.status !== "cancelled" && (
                    <Button
                      variant="destructive"
                      onClick={handleCancelInvoice}
                      disabled={cancelInvoice.isPending}
                    >
                      <Ban className="w-4 h-4 mr-2" />
                      {cancelInvoice.isPending ? "กำลังยกเลิก..." : "ยกเลิก"}
                    </Button>
                  )}
                  <Button variant="outline" onClick={handlePrint}>
                    <Printer className="w-4 h-4 mr-2" />
                    พิมพ์ซ้ำ
                  </Button>
                  <Button onClick={handleDownloadPDF}>
                    <Download className="w-4 h-4 mr-2" />
                    ดาวน์โหลด PDF
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                กำลังโหลดข้อมูล...
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
