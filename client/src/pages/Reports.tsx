import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, TrendingUp, Calendar, Package, Loader2 } from "lucide-react";
import { Link } from "wouter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function Reports() {
  const [activeTab, setActiveTab] = useState("daily");

  const { data: summary, isLoading: summaryLoading } = trpc.reports.summary.useQuery();
  const { data: dailyData, isLoading: dailyLoading } = trpc.reports.daily.useQuery();
  const { data: monthlyData, isLoading: monthlyLoading } = trpc.reports.monthly.useQuery();
  const { data: topProducts, isLoading: topLoading } = trpc.reports.topProducts.useQuery();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("th-TH").format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  };

  // Thai month names for display
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split("-");
    const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return `${monthNames[parseInt(month) - 1]} ${parseInt(year) + 543 - 2500}`;
  };

  const isLoading = summaryLoading || dailyLoading || monthlyLoading || topLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">กำลังโหลดรายงาน...</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const dailyChartData = dailyData?.map((d) => ({
    name: formatDate(d.date),
    ยอดขาย: d.totalAmount,
    รายการ: d.saleCount,
  })) || [];

  const monthlyChartData = monthlyData?.map((d) => ({
    name: formatMonth(d.month),
    ยอดขาย: d.totalAmount,
    รายการ: d.saleCount,
  })) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-secondary text-secondary-foreground p-4 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="text-secondary-foreground hover:bg-white/10">
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <TrendingUp className="w-8 h-8" />
          <div>
            <h1 className="text-lg font-bold">รายงานยอดขาย</h1>
            <p className="text-xs opacity-80">สรุปยอดขายรายวันและรายเดือน</p>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">วันนี้</p>
              <p className="text-lg font-bold text-primary">
                {formatCurrency(summary?.today.totalAmount || 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary?.today.saleCount || 0} รายการ
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-orange-500/10 border-orange-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">สัปดาห์นี้</p>
              <p className="text-lg font-bold text-orange-600">
                {formatCurrency(summary?.thisWeek.totalAmount || 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary?.thisWeek.saleCount || 0} รายการ
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-green-500/10 border-green-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">เดือนนี้</p>
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(summary?.thisMonth.totalAmount || 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary?.thisMonth.saleCount || 0} รายการ
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted">
            <TabsTrigger value="daily" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Calendar className="w-4 h-4 mr-2" />
              รายวัน
            </TabsTrigger>
            <TabsTrigger value="monthly" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <TrendingUp className="w-4 h-4 mr-2" />
              รายเดือน
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  ยอดขาย 7 วันย้อนหลัง
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailyChartData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          tickFormatter={(value) => formatCurrency(value)}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value) + " บาท", "ยอดขาย"]}
                          labelStyle={{ color: "#333" }}
                          contentStyle={{ 
                            borderRadius: "8px",
                            border: "1px solid #e5e5e5"
                          }}
                        />
                        <Bar dataKey="ยอดขาย" radius={[4, 4, 0, 0]}>
                          {dailyChartData.map((_, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={index === dailyChartData.length - 1 ? "#f59e0b" : "#fbbf24"} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <p>ยังไม่มีข้อมูลการขาย</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monthly" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  ยอดขาย 6 เดือนย้อนหลัง
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyChartData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          tickFormatter={(value) => formatCurrency(value)}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value) + " บาท", "ยอดขาย"]}
                          labelStyle={{ color: "#333" }}
                          contentStyle={{ 
                            borderRadius: "8px",
                            border: "1px solid #e5e5e5"
                          }}
                        />
                        <Bar dataKey="ยอดขาย" radius={[4, 4, 0, 0]}>
                          {monthlyChartData.map((_, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={index === monthlyChartData.length - 1 ? "#22c55e" : "#86efac"} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <p>ยังไม่มีข้อมูลการขาย</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Top Products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              สินค้าขายดี Top 5
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts && topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div
                    key={product.productId}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? "bg-yellow-400 text-yellow-900" :
                      index === 1 ? "bg-gray-300 text-gray-700" :
                      index === 2 ? "bg-orange-300 text-orange-800" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{product.productName}</p>
                      <p className="text-sm text-muted-foreground">
                        ขายได้ {product.totalQuantity} ชิ้น
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">
                        {formatCurrency(product.totalRevenue)}
                      </p>
                      <p className="text-xs text-muted-foreground">บาท</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>ยังไม่มีข้อมูลสินค้าขายดี</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
