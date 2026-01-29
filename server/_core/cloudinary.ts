/**
 * Cloudinary ปิดชั่วคราว — ใช้รูป local (client/public/products/) เท่านั้น
 * ใส่ชื่อไฟล์ใน imageUrl เช่น pruan.jpg → resolveProductImage map เป็น /products/pruan.jpg
 *
 * เมื่อจะเปิดใช้ใหม่: uncomment โค้ดด้านล่าง และเปิด products.uploadImage ใน routers.ts
 */
/*
import { v2 as cloudinary } from "cloudinary";
import { ENV } from "./env";

cloudinary.config({
  cloudinary_url: process.env.CLOUDINARY_URL,
});

export { cloudinary };

export function isCloudinaryConfigured(): boolean {
  return !!ENV.cloudinaryUrl;
}

export async function uploadProductImage(dataUri: string): Promise<string> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary ไม่ได้ตั้งค่า (ตรวจสอบ CLOUDINARY_URL ใน .env)");
  }
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "thai-smart/products",
    overwrite: true,
    resource_type: "image",
  });
  return result.secure_url;
}
*/
