import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Printer, Bluetooth, FileText, AlertCircle, Settings, Eye } from "lucide-react";
import { receiptPrinter, type BluetoothDevice } from "@/lib/receiptPrinter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import FullTaxInvoiceDialog from "./FullTaxInvoiceDialog";

interface PrintReceiptProps {
  receiptText: string;
  saleId: string | number;
  onClose?: () => void;
}

export default function PrintReceipt({
  receiptText,
  saleId,
  onClose,
}: PrintReceiptProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(
    null
  );
  const [isConnected, setIsConnected] = useState(false);
  const [showFullTaxInvoice, setShowFullTaxInvoice] = useState(false);
  const [showSellerInfoAlert, setShowSellerInfoAlert] = useState(false);

  // ตรวจสอบว่าบิลนี้มี VAT หรือไม่ (เพื่อแสดงปุ่มออกใบกำกับภาษีเต็ม)
  const { data: saleData } = trpc.fullTaxInvoice.getSaleData.useQuery(
    { saleId },
    { enabled: true, retry: false }
  );
  
  // ตรวจสอบว่ามีใบกำกับภาษีเต็มอยู่แล้วหรือไม่
  const { data: invoiceExists } = trpc.fullTaxInvoice.checkExists.useQuery(
    { saleId },
    { enabled: true }
  );

  // ดึงข้อมูล Settings เพื่อตรวจสอบข้อมูลผู้ขาย
  const { data: settings } = trpc.system.settings.get.useQuery();

  // ตรวจสอบว่าข้อมูลผู้ขายครบหรือไม่
  const isSellerInfoComplete =
    settings?.sellerName &&
    settings.sellerName.trim() &&
    settings?.sellerAddress &&
    settings.sellerAddress.trim() &&
    settings?.sellerTaxId &&
    settings.sellerTaxId.trim() &&
    /^\d{13}$/.test(settings.sellerTaxId.replace(/\s|-/g, "")); // ตรวจสอบว่าเป็นตัวเลข 13 หลัก

  const hasVat = saleData !== undefined; // ถ้า getSaleData สำเร็จ = มี VAT

  // Handler สำหรับปุ่มออกใบกำกับภาษีเต็ม
  const handleOpenFullTaxInvoice = () => {
    // ตรวจสอบข้อมูลผู้ขายก่อน
    if (!isSellerInfoComplete) {
      setShowSellerInfoAlert(true);
      return;
    }
    // ถ้าข้อมูลครบ → เปิด dialog
    setShowFullTaxInvoice(true);
  };

  const handleScanPrinters = async () => {
    setIsScanning(true);
    try {
      const foundDevices = await receiptPrinter.scanForPrinters();
      setDevices(foundDevices);

      if (foundDevices.length === 0) {
        toast.info("ไม่พบเครื่องพิมพ์ Bluetooth ที่ใกล้เคียง");
      } else {
        toast.success(`พบเครื่องพิมพ์ ${foundDevices.length} เครื่อง`);
        setSelectedDevice(foundDevices[0]);
      }
    } catch (error) {
      toast.error(
        `ไม่สามารถสแกนเครื่องพิมพ์: ${(error as Error).message}`
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedDevice) {
      toast.error("กรุณาเลือกเครื่องพิมพ์");
      return;
    }

    try {
      await receiptPrinter.connect(selectedDevice.id);
      setIsConnected(true);
      toast.success(`เชื่อมต่อกับ ${selectedDevice.name} สำเร็จ`);
    } catch (error) {
      toast.error(
        `ไม่สามารถเชื่อมต่อ: ${(error as Error).message}`
      );
    }
  };

  const handlePrint = async () => {
    if (!isConnected) {
      toast.error("ยังไม่ได้เชื่อมต่อกับเครื่องพิมพ์");
      return;
    }

    setIsPrinting(true);
    try {
      await receiptPrinter.printReceipt(receiptText);
      toast.success("พิมพ์ใบเสร็จสำเร็จ");
      if (onClose) {
        onClose();
      }
    } catch (error) {
      toast.error(
        `ไม่สามารถพิมพ์: ${(error as Error).message}`
      );
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDisconnect = async () => {
    await receiptPrinter.disconnect();
    setIsConnected(false);
    setSelectedDevice(null);
    toast.info("ตัดการเชื่อมต่อแล้ว");
  };

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">พิมพ์ใบเสร็จ #{saleId}</h2>
        <p className="text-sm text-gray-600">
          ใช้เครื่องพิมพ์ความร้อนผ่าน Bluetooth
        </p>
      </div>

      {/* Preview ใบเสร็จ - Optimized for 80mm thermal printer */}
      <Card className="bg-white p-4 border-2 border-gray-300">
        <div className="mx-auto" style={{ width: "288px", maxWidth: "100%" }}>
          {/* 80mm = ~288px at 96 DPI (72mm printable area) */}
          <pre 
            className="text-[10px] font-mono whitespace-pre-wrap break-words leading-tight"
            style={{
              fontFamily: "'Courier New', 'Courier', monospace",
              letterSpacing: "0.5px",
              lineHeight: "1.3",
              wordBreak: "break-word",
            }}
          >
          {receiptText}
        </pre>
        </div>
      </Card>

      {/* ขั้นตอนการเชื่อมต่อ */}
      <div className="space-y-3">
        {/* ขั้นตอนที่ 1: สแกนเครื่องพิมพ์ */}
        <div className="space-y-2">
          <Button
            onClick={handleScanPrinters}
            disabled={isScanning || isConnected}
            variant="outline"
            className="w-full"
          >
            {isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                กำลังสแกน...
              </>
            ) : (
              <>
                <Bluetooth className="mr-2 h-4 w-4" />
                สแกนเครื่องพิมพ์ Bluetooth
              </>
            )}
          </Button>
        </div>

        {/* แสดงรายการเครื่องพิมพ์ */}
        {devices.length > 0 && !isConnected && (
          <div className="space-y-2">
            <p className="text-sm font-medium">เลือกเครื่องพิมพ์:</p>
            <div className="space-y-2">
              {devices.map((device) => (
                <Button
                  key={device.id}
                  onClick={() => setSelectedDevice(device)}
                  variant={
                    selectedDevice?.id === device.id ? "default" : "outline"
                  }
                  className="w-full justify-start"
                >
                  <Bluetooth className="mr-2 h-4 w-4" />
                  {device.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* ขั้นตอนที่ 2: เชื่อมต่อ */}
        {selectedDevice && !isConnected && (
          <Button
            onClick={handleConnect}
            className="w-full bg-yellow-400 text-black hover:bg-yellow-500"
          >
            เชื่อมต่อกับ {selectedDevice.name}
          </Button>
        )}

        {/* สถานะการเชื่อมต่อ */}
        {isConnected && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
            ✓ เชื่อมต่อกับ {selectedDevice?.name} สำเร็จ
          </div>
        )}

        {/* ขั้นตอนที่ 3: พิมพ์ */}
        {isConnected && (
          <div className="space-y-2">
            <Button
              onClick={handlePrint}
              disabled={isPrinting}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังพิมพ์...
                </>
              ) : (
                <>
                  <Printer className="mr-2 h-4 w-4" />
                  พิมพ์ใบเสร็จ
                </>
              )}
            </Button>

            <Button
              onClick={handleDisconnect}
              variant="outline"
              className="w-full"
            >
              ตัดการเชื่อมต่อ
            </Button>
          </div>
        )}
      </div>

      {/* ปุ่มออกใบกำกับภาษีเต็ม (แสดงเฉพาะบิลที่มี VAT) */}
      {hasVat && (
        <div className="border-t pt-4 space-y-2">
          {invoiceExists ? (
            // ถ้ามีใบกำกับภาษีเต็มอยู่แล้ว → แสดงปุ่ม "ดู" และ "พิมพ์ซ้ำ"
            <>
              <Button
                onClick={handleOpenFullTaxInvoice}
                variant="outline"
                className="w-full"
              >
                <Eye className="w-4 h-4 mr-2" />
                ดูใบกำกับภาษีเต็ม
              </Button>
              <Button
                onClick={handleOpenFullTaxInvoice}
                variant="default"
                className="w-full"
              >
                <Printer className="w-4 h-4 mr-2" />
                พิมพ์ซ้ำ
              </Button>
            </>
          ) : (
            // ถ้ายังไม่มี → แสดงปุ่ม "ออกใบกำกับภาษีเต็ม"
            <Button
              onClick={handleOpenFullTaxInvoice}
              variant="outline"
              className="w-full"
            >
              <FileText className="w-4 h-4 mr-2" />
              ออกใบกำกับภาษีเต็ม
            </Button>
          )}
        </div>
      )}

      {/* ปุ่มปิด */}
      {onClose && (
        <Button onClick={onClose} variant="ghost" className="w-full">
          ปิด
        </Button>
      )}

      {/* Alert Dialog - แจ้งเตือนข้อมูลผู้ขายไม่ครบ */}
      <AlertDialog open={showSellerInfoAlert} onOpenChange={setShowSellerInfoAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              กรุณาตั้งค่าข้อมูลร้านก่อน
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              <p className="mb-3">
                เพื่อออกใบกำกับภาษีเต็ม ต้องตั้งค่าข้อมูลร้านให้ครบถ้วนก่อน:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm mb-4">
                {(!settings?.sellerName?.trim() && <li>ชื่อร้าน</li>)}
                {(!settings?.sellerAddress?.trim() && <li>ที่อยู่ร้าน</li>)}
                {(!settings?.sellerTaxId?.trim() || 
                  !/^\d{13}$/.test(settings?.sellerTaxId?.replace(/\s|-/g, "") || "")) && (
                  <li>เลขประจำตัวผู้เสียภาษี (13 หลัก)</li>
                )}
              </ul>
              <p className="text-sm text-muted-foreground">
                ไปตั้งค่าข้อมูลร้านได้ที่หน้า "ตั้งค่า"
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ปิด</AlertDialogCancel>
            <Link href="/settings">
              <AlertDialogAction asChild>
                <Button>
                  <Settings className="w-4 h-4 mr-2" />
                  ไปหน้าตั้งค่าข้อมูลร้าน
                </Button>
              </AlertDialogAction>
            </Link>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Full Tax Invoice Dialog */}
      <FullTaxInvoiceDialog
        saleId={saleId}
        open={showFullTaxInvoice}
        onOpenChange={setShowFullTaxInvoice}
        onClose={() => {
          // ไม่ต้องทำอะไรเมื่อปิด dialog
        }}
      />
    </div>
  );
}
