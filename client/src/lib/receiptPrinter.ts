/**
 * Receipt Printer Utility
 * ใช้ Web Bluetooth API เพื่อเชื่อมต่อและพิมพ์ใบเสร็จบนเครื่องพิมพ์ความร้อน
 */

const THERMAL_PRINTER_SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";
const THERMAL_PRINTER_CHAR_UUID = "00002af1-0000-1000-8000-00805f9b34fb";

export interface BluetoothDevice {
  name: string;
  id: string;
}

export class ReceiptPrinter {
  private device: any = null;
  private characteristic: any = null;

  /**
   * สแกนหาเครื่องพิมพ์ Bluetooth ที่ใกล้เคียง
   */
  async scanForPrinters(): Promise<BluetoothDevice[]> {
    const bluetoothNav = navigator as any;
    if (!bluetoothNav.bluetooth) {
      throw new Error("Web Bluetooth API ไม่รองรับในเบราวเซอร์นี้");
    }

    try {
      const device = await bluetoothNav.bluetooth.requestDevice({
        filters: [
          { services: [THERMAL_PRINTER_SERVICE_UUID] },
          { namePrefix: "Printer" },
          { namePrefix: "POS" },
        ],
        optionalServices: [THERMAL_PRINTER_SERVICE_UUID],
      });

      return [
        {
          name: device.name || "Unknown Printer",
          id: device.id,
        },
      ];
    } catch (error) {
      if ((error as Error).name === "NotFoundError") {
        return [];
      }
      throw error;
    }
  }

  /**
   * เชื่อมต่อกับเครื่องพิมพ์
   */
  async connect(deviceId: string): Promise<void> {
    const bluetoothNav = navigator as any;
    if (!bluetoothNav.bluetooth) {
      throw new Error("Web Bluetooth API ไม่รองรับในเบราวเซอร์นี้");
    }

    try {
      const devices = await bluetoothNav.bluetooth.getAvailability();
      if (!devices) {
        throw new Error("Bluetooth ไม่พร้อมใช้งาน");
      }

      // ขออนุญาตเชื่อมต่อ
      const device = await bluetoothNav.bluetooth.requestDevice({
        filters: [{ services: [THERMAL_PRINTER_SERVICE_UUID] }],
      });

      this.device = await (device as any).gatt?.connect();
      if (!this.device) {
        throw new Error("ไม่สามารถเชื่อมต่อกับเครื่องพิมพ์");
      }

      const service = await this.device.getPrimaryService(
        THERMAL_PRINTER_SERVICE_UUID
      );
      this.characteristic = await service.getCharacteristic(
        THERMAL_PRINTER_CHAR_UUID
      );
    } catch (error) {
      throw new Error(`ไม่สามารถเชื่อมต่อกับเครื่องพิมพ์: ${(error as Error).message}`);
    }
  }

  /**
   * ตัดการเชื่อมต่อ
   */
  async disconnect(): Promise<void> {
    if (this.device) {
      this.device.disconnect();
      this.device = null;
      this.characteristic = null;
    }
  }

  /**
   * ส่งข้อมูลไปยังเครื่องพิมพ์
   */
  private async sendData(data: Uint8Array): Promise<void> {
    if (!this.characteristic) {
      throw new Error("ไม่ได้เชื่อมต่อกับเครื่องพิมพ์");
    }

    try {
      await this.characteristic.writeValue(data);
    } catch (error) {
      throw new Error(`ไม่สามารถส่งข้อมูลไปยังเครื่องพิมพ์: ${(error as Error).message}`);
    }
  }

  /**
   * แปลงข้อความเป็น Uint8Array สำหรับพิมพ์
   */
  private textToBytes(text: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(text);
  }

  /**
   * พิมพ์ใบเสร็จ - Optimized for 80mm thermal printer
   * ESC/POS commands configured for 80mm paper width
   */
  async printReceipt(receiptText: string): Promise<void> {
    if (!this.characteristic) {
      throw new Error("ไม่ได้เชื่อมต่อกับเครื่องพิมพ์");
    }

    try {
      // Initialize printer (ESC @)
      const initSequence = new Uint8Array([0x1b, 0x40]);
      await this.sendData(initSequence);

      // Set paper width to 80mm (ESC W n1 n2 n3 n4)
      // n1=0, n2=80 (0x50), n3=0, n4=0 for 80mm
      // Most printers auto-detect, but we set it explicitly
      const setWidth80mm = new Uint8Array([0x1b, 0x57, 0x00, 0x50, 0x00, 0x00]);
      await this.sendData(setWidth80mm);

      // Set character font to Font A (default, readable size for 80mm)
      // ESC M n: n=0 (Font A, 12x24), n=1 (Font B, 9x17)
      const setFontA = new Uint8Array([0x1b, 0x4d, 0x00]);
      await this.sendData(setFontA);

      // Set line spacing to 30/180 inch (compact but readable)
      // ESC 3 n: n=30 (default is 24, 30 gives better spacing)
      const setLineSpacing = new Uint8Array([0x1b, 0x33, 0x1e]);
      await this.sendData(setLineSpacing);

      // Set left margin (optional, for alignment)
      // ESC l n: n=0 (no left margin)
      const setLeftMargin = new Uint8Array([0x1b, 0x6c, 0x00]);
      await this.sendData(setLeftMargin);

      // Send receipt text (UTF-8 encoded)
      const textBytes = this.textToBytes(receiptText);
      await this.sendData(textBytes);

      // Feed paper 3 lines before cutting
      const feedLines = new Uint8Array([0x1b, 0x64, 0x03]);
      await this.sendData(feedLines);

      // Cut paper (partial cut for 80mm)
      // ESC i: Full cut, ESC m: Partial cut
      const cutSequence = new Uint8Array([0x1b, 0x69]); // ESC i (full cut)
      await this.sendData(cutSequence);

      // Reset printer to default state
      const resetSequence = new Uint8Array([0x1b, 0x40]);
      await this.sendData(resetSequence);
    } catch (error) {
      throw new Error(`ไม่สามารถพิมพ์ใบเสร็จ: ${(error as Error).message}`);
    }
  }

  /**
   * ตรวจสอบว่าเชื่อมต่ออยู่หรือไม่
   */
  isConnected(): boolean {
    return this.device !== null && this.characteristic !== null;
  }
}

export const receiptPrinter = new ReceiptPrinter();
