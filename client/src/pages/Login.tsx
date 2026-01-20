import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Login() {
  const utils = trpc.useUtils();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      console.log("[Login] Login successful, data:", data);
      
      // Set user data in cache and localStorage immediately
      if (data.user) {
        utils.auth.me.setData(undefined, data.user);
        localStorage.setItem("manus-runtime-user-info", JSON.stringify(data.user));
      }
      
      toast.success("เข้าสู่ระบบสำเร็จ", { duration: 1500 });
      
      // Wait for cookie to be fully set, then do full page reload to ensure cookie is sent
      // Full page reload ensures the cookie is available for auth.me query
      setTimeout(() => {
        console.log("[Login] Redirecting to home page with full reload...");
        // Full page reload ensures cookie is sent and auth state is verified
        window.location.href = "/";
      }, 500);
    },
    onError: (error) => {
      toast.error(error.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/mascot.png" alt="Thai Smart" className="w-20 h-20" />
          </div>
          <CardTitle className="text-2xl">เข้าสู่ระบบ</CardTitle>
          <CardDescription>
            เข้าสู่ระบบ Thai Smart POS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                disabled={loginMutation.isPending}
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
                disabled={loginMutation.isPending}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              เข้าสู่ระบบ
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">ยังไม่มีบัญชี? </span>
            <Link href="/register" className="text-primary hover:underline">
              สมัครสมาชิก
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
