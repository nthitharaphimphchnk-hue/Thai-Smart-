export function resolveProductImage(imageUrl?: string | null) {
  if (!imageUrl) return null;

  // ถ้าเป็น URL เต็ม (เผื่ออนาคต)
  if (imageUrl.startsWith("http")) {
    return imageUrl;
  }

  // กรณีเก็บแค่ชื่อไฟล์ เช่น pruan.jpg
  const clean = imageUrl.replace(/^\/+/, "");
  return `/products/${clean}`;
}
