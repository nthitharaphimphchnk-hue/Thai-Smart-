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
   * พิมพ์ใบเสร็จ
   */
  async printReceipt(receiptText: string): Promise<void> {
    if (!this.characteristic) {
      throw new Error("ไม่ได้เชื่อมต่อกับเครื่องพิมพ์");
    }

    try {
      // ส่งคำสั่ง ESC/POS เพื่อเตรียมเครื่องพิมพ์
      const initSequence = new Uint8Array([0x1b, 0x40]); // ESC @
      await this.sendData(initSequence);

      // ส่งข้อความ
      const textBytes = this.textToBytes(receiptText);
      await this.sendData(textBytes);

      // ส่งคำสั่งตัดกระดาษ
      const cutSequence = new Uint8Array([0x1b, 0x69]); // ESC i
      await this.sendData(cutSequence);

      // ส่งคำสั่งให้เครื่องพิมพ์กลับสู่สถานะเริ่มต้น
      const resetSequence = new Uint8Array([0x1b, 0x40]); // ESC @
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
