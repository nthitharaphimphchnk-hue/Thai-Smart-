import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Package,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Upload,
  FileText,
  PackagePlus,
  History,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

interface ProductForm {
  name: string;
  barcode: string;
  price: string;
  stock: number;
  reorderPoint: number;
}

export default function Products() {
  const [showForm, setShowForm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProductForm>({
    name: "",
    barcode: "",
    price: "",
    stock: 0,
    reorderPoint: 5,
  });

  const { data: products, isLoading, refetch } = trpc.products.list.useQuery();
  
  const createProduct = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("เพิ่มสินค้าสำเร็จ");
      resetForm();
      refetch();
    },
    onError: () => toast.error("เกิดข้อผิดพลาด"),
  });

  const updateProduct = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success("แก้ไขสินค้าสำเร็จ");
      resetForm();
      refetch();
    },
    onError: () => toast.error("เกิดข้อผิดพลาด"),
  });

  const deleteProduct = trpc.products.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบสินค้าสำเร็จ");
      setDeleteId(null);
      refetch();
    },
    onError: () => toast.error("เกิดข้อผิดพลาด"),
  });

  const importProducts = trpc.products.import.useMutation({
    onSuccess: (data) => {
      toast.success(`นำเข้าสินค้าสำเร็จ ${data.count} รายการ`);
      setShowImportDialog(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "เกิดข้อผิดพลาดในการนำเข้าสินค้า");
    },
  });

  const resetForm = () => {
    setForm({ name: "", barcode: "", price: "", stock: 0, reorderPoint: 5 });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (product: {
    id: string | number;
    name: string;
    price: string;
    stock: number;
    reorderPoint?: number;
    minStock?: number;
    barcode?: string | null;
  }) => {
    setForm({
      name: product.name,
      barcode: product.barcode ?? "",
      price: product.price,
      stock: product.stock,
      reorderPoint: product.reorderPoint ?? product.minStock ?? 5,
    });
    setEditingId(String(product.id));
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("กรุณาใส่ชื่อสินค้า");
      return;
    }
    if (!form.price || parseFloat(form.price) <= 0) {
      toast.error("กรุณาใส่ราคาที่ถูกต้อง");
      return;
    }

    if (editingId) {
      updateProduct.mutate({
        id: editingId,
        name: form.name,
        price: form.price,
        stock: form.stock,
        reorderPoint: form.reorderPoint,
        barcode: form.barcode.trim() || undefined,
      });
    } else {
      createProduct.mutate({
        name: form.name,
        price: form.price,
        stock: form.stock,
        reorderPoint: form.reorderPoint,
        barcode: form.barcode.trim() || undefined,
      });
    }
  };

  const parseCSV = (
    text: string
  ): Array<{
    name: string;
    price: string | number;
    stock?: number;
    reorderPoint?: number;
  }> => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    // Check if first line is header
    const hasHeader = lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('ชื่อ');
    const dataLines = hasHeader ? lines.slice(1) : lines;
    
    return dataLines.map((line) => {
      // Support both comma and tab separated
      const parts = line.includes('\t') ? line.split('\t') : line.split(',').map(p => p.trim());
      
      return {
        name: parts[0]?.trim() || '',
        price: parts[1]?.trim() || '0',
        stock: parts[2] ? parseInt(parts[2].trim()) || 0 : undefined,
        reorderPoint: parts[3] ? parseInt(parts[3].trim()) || 5 : undefined,
      };
    }).filter(p => p.name); // Filter out empty names
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension !== 'csv' && fileExtension !== 'json') {
      toast.error("รองรับเฉพาะไฟล์ CSV หรือ JSON");
      return;
    }

    try {
      const text = await file.text();
      let products: Array<{
        name: string;
        price: string | number;
        stock?: number;
        reorderPoint?: number;
      }> = [];

      if (fileExtension === 'csv') {
        products = parseCSV(text);
      } else if (fileExtension === 'json') {
        const jsonData = JSON.parse(text);
        if (Array.isArray(jsonData)) {
          products = jsonData.map((item: any) => ({
            name: item.name || item.ชื่อสินค้า || '',
            price: item.price || item.ราคา || '0',
            stock: item.stock ?? item.จำนวนคงเหลือ,
            reorderPoint:
              item.reorderPoint ?? item.minStock ?? item.แจ้งเตือนเมื่อเหลือ,
          })).filter((p: any) => p.name);
        } else {
          toast.error("ไฟล์ JSON ต้องเป็น array ของสินค้า");
          return;
        }
      }

      if (products.length === 0) {
        toast.error("ไม่พบข้อมูลสินค้าในไฟล์");
        return;
      }

      importProducts.mutate({ products });
    } catch (error: any) {
      toast.error(`เกิดข้อผิดพลาดในการอ่านไฟล์: ${error.message}`);
    }
  };

  // Small compatibility adapter: older client code used `minStock` and numeric ids.
  const productsForUi = useMemo(() => {
    return (
      products?.map((p: any) => ({
        ...p,
        id: String(p.id),
        reorderPoint: p.reorderPoint ?? p.minStock ?? 5,
      })) ?? []
    );
  }, [products]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-secondary text-secondary-foreground p-4">
        <div className="flex items-center gap-4 mb-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-secondary-foreground hover:bg-white/10">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold flex-1">จัดการสินค้า</h1>
        </div>
        {/* Action Buttons - Icon + Text */}
        <div className="flex flex-wrap gap-2">
          <Link href="/stock-in">
            <Button
              variant="ghost"
              className="text-secondary-foreground hover:bg-white/10 h-auto py-2 px-3"
              onClick={() => {}} // Keep handler for consistency
            >
              <PackagePlus className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">รับสินค้าเข้า</span>
            </Button>
          </Link>
          <Link href="/stock-history">
            <Button
              variant="ghost"
              className="text-secondary-foreground hover:bg-white/10 h-auto py-2 px-3"
              onClick={() => {}} // Keep handler for consistency
            >
              <History className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">ประวัติสต็อก</span>
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="text-secondary-foreground hover:bg-white/10 h-auto py-2 px-3"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">เพิ่มสินค้าใหม่</span>
          </Button>
          <Button
            variant="ghost"
            className="text-secondary-foreground hover:bg-white/10 h-auto py-2 px-3"
            onClick={() => setShowImportDialog(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">นำเข้าสินค้า</span>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
        ) : productsForUi?.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">ยังไม่มีสินค้า</h2>
            <p className="text-muted-foreground mb-4">เริ่มต้นเพิ่มสินค้าของคุณ</p>
            <Button className="ts-btn-primary" onClick={() => setShowForm(true)}>
              <Plus className="w-5 h-5" />
              เพิ่มสินค้าใหม่
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              สินค้าทั้งหมด {productsForUi?.length} รายการ
            </p>
            {productsForUi?.map((product) => {
              const reorderPoint = product.reorderPoint ?? 5;
              const isLow = Number(product.stock) <= Number(reorderPoint);
              return (
              <div key={product.id} className="ts-card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    <p className="text-primary font-bold text-xl">
                      ฿{parseFloat(product.price).toLocaleString()}
                    </p>
                    <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                      <span>คงเหลือ: {product.stock}</span>
                      <span>จุดสั่งซื้อ: {reorderPoint}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          isLow ? "bg-ts-warning/20 text-ts-warning" : "bg-ts-success/20 text-ts-success"
                        }`}
                      >
                        {isLow ? "ใกล้หมด" : "ปกติ"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/stock-in?productId=${String(product.id)}`}>
                      <Button 
                        variant="ghost" 
                        className="h-8 px-2 text-xs"
                        onClick={() => {}}
                      >
                        <PackagePlus className="w-3 h-3 mr-1" />
                        <span>รับเข้า</span>
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => handleEdit(product)}
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      <span>แก้ไข</span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(String(product.id))}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      <span>ลบ</span>
                    </Button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingId ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                ชื่อสินค้า *
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="ts-input"
                placeholder="เช่น ปุ๋ยยูเรีย"
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                บาร์โค้ดสินค้า
              </label>
              <Input
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                className="ts-input"
                placeholder="เช่น 8850123456789"
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                ราคาขาย (บาท) *
              </label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="ts-input"
                placeholder="0"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  จำนวนคงเหลือ
                </label>
                <Input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })}
                  className="ts-input"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  แจ้งเตือนเมื่อเหลือ
                </label>
                <Input
                  type="number"
                  value={form.reorderPoint}
                  onChange={(e) =>
                    setForm({ ...form, reorderPoint: parseInt(e.target.value) || 5 })
                  }
                  className="ts-input"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm} className="flex-1">
              <X className="w-4 h-4 mr-2" />
              ยกเลิก
            </Button>
            <Button
              className="ts-btn-primary flex-1"
              onClick={handleSubmit}
              disabled={createProduct.isPending || updateProduct.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              {createProduct.isPending || updateProduct.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Upload className="w-5 h-5" />
              นำเข้าสินค้า
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">รองรับไฟล์ CSV หรือ JSON</p>
              <p className="text-xs text-muted-foreground mb-3">
                <strong>รูปแบบ CSV:</strong><br />
                ชื่อสินค้า,ราคา,จำนวนคงเหลือ,แจ้งเตือนเมื่อเหลือ
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>รูปแบบ JSON:</strong><br />
                [&#123;"name": "สินค้า1", "price": "100", "stock": 10, "minStock": 5&#125;, ...]
              </p>
            </div>

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileImport}
                className="hidden"
                id="file-import"
              />
              <label htmlFor="file-import">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={importProducts.isPending}
                  asChild
                >
                  <span className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    เลือกไฟล์ CSV หรือ JSON
                  </span>
                </Button>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              ยกเลิก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบสินค้านี้หรือไม่? การลบจะไม่สามารถกู้คืนได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId && deleteProduct.mutate({ id: deleteId })}
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
