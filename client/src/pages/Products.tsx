import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Package, Plus, Edit2, Trash2, Save, X } from "lucide-react";
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
  price: string;
  stock: number;
  minStock: number;
}

export default function Products() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>({
    name: "",
    price: "",
    stock: 0,
    minStock: 5,
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

  const resetForm = () => {
    setForm({ name: "", price: "", stock: 0, minStock: 5 });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (product: {
    id: number;
    name: string;
    price: string;
    stock: number;
    minStock: number;
  }) => {
    setForm({
      name: product.name,
      price: product.price,
      stock: product.stock,
      minStock: product.minStock,
    });
    setEditingId(product.id);
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
        minStock: form.minStock,
      });
    } else {
      createProduct.mutate({
        name: form.name,
        price: form.price,
        stock: form.stock,
        minStock: form.minStock,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-secondary text-secondary-foreground p-4 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="text-secondary-foreground hover:bg-white/10">
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1">จัดการสินค้า</h1>
        <Button
          variant="ghost"
          size="icon"
          className="text-secondary-foreground hover:bg-white/10"
          onClick={() => setShowForm(true)}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
        ) : products?.length === 0 ? (
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
              สินค้าทั้งหมด {products?.length} รายการ
            </p>
            {products?.map((product) => (
              <div key={product.id} className="ts-card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    <p className="text-primary font-bold text-xl">
                      ฿{parseFloat(product.price).toLocaleString()}
                    </p>
                    <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                      <span>คงเหลือ: {product.stock}</span>
                      <span>ขั้นต่ำ: {product.minStock}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(product)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setDeleteId(product.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
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
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: parseInt(e.target.value) || 5 })}
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
