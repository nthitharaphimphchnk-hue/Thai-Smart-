import { v2 as cloudinary } from "cloudinary";
import { ENV } from "./env";

const FOLDER = "thai-smart/products";

export function isCloudinaryConfigured(): boolean {
  return !!(ENV.cloudinary.cloudName && ENV.cloudinary.apiKey && ENV.cloudinary.apiSecret);
}

/**
 * อัปโหลดรูปสินค้าไป Cloudinary
 * @param dataUri - data URI เช่น "data:image/jpeg;base64,..."
 * @param publicIdPrefix - optional prefix สำหรับ public_id (จะถูก sanitize)
 * @returns URL เต็มของรูปบน Cloudinary
 */
export async function uploadProductImage(
  dataUri: string,
  publicIdPrefix?: string | null
): Promise<string> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary ไม่ได้ตั้งค่า (ตรวจสอบ CLOUDINARY_* ใน .env)");
  }

  cloudinary.config({
    cloud_name: ENV.cloudinary.cloudName,
    api_key: ENV.cloudinary.apiKey,
    api_secret: ENV.cloudinary.apiSecret,
  });

  // public_id: lowercase, no spaces, unique (เพิ่ม timestamp)
  const safeId = publicIdPrefix
    ? publicIdPrefix.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-_.]/g, "").slice(0, 80)
    : "";
  const publicId = safeId ? `${safeId}-${Date.now()}` : String(Date.now());

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: FOLDER,
    public_id: publicId,
    overwrite: true,
    resource_type: "image",
  });

  return result.secure_url;
}
