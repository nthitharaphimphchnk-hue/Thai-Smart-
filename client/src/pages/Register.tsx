import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Register() {
  const utils = trpc.useUtils();
  const { refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (data) => {
      console.log("[Register] Registration successful, redirecting...", data);
      
      // Set user data in cache and localStorage immediately
      if (data.user) {
        utils.auth.me.setData(undefined, data.user);
        localStorage.setItem("manus-runtime-user-info", JSON.stringify(data.user));
      }
      
      toast.success("สมัครสมาชิกสำเร็จ", { duration: 1500 });
      
      // Wait for cookie to be fully set, then do full page reload to ensure cookie is sent
      // Full page reload ensures the cookie is available for auth.me query
      setTimeout(() => {
        console.log("[Register] Redirecting to home page with full reload...");
        // Full page reload ensures cookie is sent and auth state is verified
        window.location.href = "/";
      }, 500);
    },
    onError: (error) => {
      toast.error(error.message || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    if (password.length < 6) {
      toast.error("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("รหัสผ่านไม่ตรงกัน");
      return;
    }

    registerMutation.mutate({
      email,
      password,
      name: name || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/mascot.png" alt="Thai Smart" className="w-20 h-20" />
          </div>
          <CardTitle className="text-2xl">สมัครสมาชิก</CardTitle>
          <CardDescription>
            สร้างบัญชีใหม่สำหรับ Thai Smart POS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                ชื่อ (ไม่บังคับ)
              </label>
              <Input
                id="name"
                type="text"
                placeholder="ชื่อของคุณ"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={registerMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                อีเมล
              </label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={registerMutation.isPending}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                รหัสผ่าน
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={registerMutation.isPending}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                ยืนยันรหัสผ่าน
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={registerMutation.isPending}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              สมัครสมาชิก
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">มีบัญชีแล้ว? </span>
            <Link href="/login" className="text-primary hover:underline">
              เข้าสู่ระบบ
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
