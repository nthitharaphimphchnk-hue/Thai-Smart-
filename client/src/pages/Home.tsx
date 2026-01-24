import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package, Users, MessageCircle, LogIn, LogOut, TrendingUp, UserPlus, Settings } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();

  // ❌ ลบ loading state - ใช้แค่เช็ก user
  // if (loading) {
  //   return (
  //     <div className="min-h-screen bg-background flex items-center justify-center">
  //       <div className="text-center">
  //         <img src="/mascot.png" alt="Thai Smart" className="w-32 h-32 mx-auto mb-4 animate-bounce" />
  //         <p className="text-lg text-muted-foreground">กำลังโหลด...</p>
  //       </div>
  //     </div>
  //   );
  // }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Welcome Screen */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <img src="/mascot.png" alt="Thai Smart" className="w-40 h-40 mb-6" />
          <h1 className="text-3xl font-bold text-foreground mb-2">Thai Smart</h1>
          <p className="text-lg text-muted-foreground mb-8 text-center">
            สมุดจดร้านดิจิทัล<br />
            ช่วยให้ร้านทำงานน้อยลง
          </p>
          <div className="w-full max-w-xs space-y-3">
            <Link href="/login" className="ts-btn-primary w-full flex items-center justify-center gap-3">
              <LogIn className="w-5 h-5" />
              <span>เข้าสู่ระบบ</span>
            </Link>
            <Link href="/register" className="ts-btn-secondary w-full flex items-center justify-center gap-3">
              <UserPlus className="w-5 h-5" />
              <span>สมัครสมาชิก</span>
            </Link>
          </div>
        </div>
        
        {/* Footer */}
        <footer className="p-4 text-center text-sm text-muted-foreground">
          ระบบ POS สำหรับร้านค้าชุมชน
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-secondary text-secondary-foreground p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/mascot.png" alt="Thai Smart" className="w-10 h-10" />
          <div>
            <h1 className="text-lg font-bold">Thai Smart</h1>
            <p className="text-xs opacity-80">สวัสดี, {user?.name || 'เจ้าของร้าน'}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="text-secondary-foreground hover:bg-white/10 px-3"
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          <span className="text-sm font-medium">ออกจากระบบ</span>
        </Button>
      </header>

      {/* Main Content - 4 Big Buttons */}
      <main className="flex-1 p-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 flex-1">
          {/* ขายของ */}
          <Link href="/sell" className="ts-action-btn bg-primary text-primary-foreground">
            <ShoppingCart className="w-12 h-12" />
            <span className="text-xl font-bold">ขายของ</span>
          </Link>

          {/* ของใกล้หมด */}
          <Link href="/low-stock" className="ts-action-btn bg-ts-warning text-ts-black">
            <Package className="w-12 h-12" />
            <span className="text-xl font-bold">ของใกล้หมด</span>
          </Link>

          {/* ลูกค้าค้างเงิน */}
          <Link href="/debtors" className="ts-action-btn bg-ts-danger text-white">
            <Users className="w-12 h-12" />
            <span className="text-xl font-bold">ลูกค้าค้างเงิน</span>
          </Link>

          {/* คุยกับ AI */}
          <Link href="/chat" className="ts-action-btn bg-secondary text-secondary-foreground">
            <MessageCircle className="w-12 h-12" />
            <span className="text-xl font-bold">คุยกับ AI</span>
          </Link>
        </div>

        {/* Quick Stats */}
        <QuickStats />
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-card border-t border-border p-2 flex justify-around">
        <Link href="/" className="flex flex-col items-center p-2 text-primary">
          <ShoppingCart className="w-6 h-6" />
          <span className="text-xs mt-1">หน้าแรก</span>
        </Link>
        <Link href="/products" className="flex flex-col items-center p-2 text-muted-foreground hover:text-primary">
          <Package className="w-6 h-6" />
          <span className="text-xs mt-1">สินค้า</span>
        </Link>
        <Link href="/reports" className="flex flex-col items-center p-2 text-muted-foreground hover:text-primary">
          <TrendingUp className="w-6 h-6" />
          <span className="text-xs mt-1">รายงาน</span>
        </Link>
        <Link href="/chat" className="flex flex-col items-center p-2 text-muted-foreground hover:text-primary">
          <MessageCircle className="w-6 h-6" />
          <span className="text-xs mt-1">ถาม AI</span>
        </Link>
        <Link href="/settings" className="flex flex-col items-center p-2 text-muted-foreground hover:text-primary">
          <Settings className="w-6 h-6" />
          <span className="text-xs mt-1">ตั้งค่า</span>
        </Link>
      </nav>
    </div>
  );
}

function QuickStats() {
  const { data: analytics } = trpc.analytics.dashboard.useQuery();

  if (!analytics) return null;

  return (
    <div className="ts-card">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-ts-success">
            {analytics.todaySales.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">ยอดขายวันนี้ (บาท)</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-ts-warning">
            {analytics.lowStockCount}
          </p>
          <p className="text-xs text-muted-foreground">สินค้าใกล้หมด</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-ts-danger">
            {analytics.debtorCount}
          </p>
          <p className="text-xs text-muted-foreground">ลูกค้าค้างเงิน</p>
        </div>
      </div>
    </div>
  );
}
