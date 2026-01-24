import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileText, Search, Printer, Eye, XCircle, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import FullTaxInvoiceDialog from "./FullTaxInvoiceDialog";

export default function FullTaxInvoices() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<{
    saleId: string;
    open: boolean;
  } | null>(null);

  const { data: invoices, isLoading } = trpc.fullTaxInvoice.list.useQuery({
    limit: 100,
  });

  // Filter invoices by search term
  const filteredInvoices = invoices?.filter((invoice) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      invoice.invoiceNumber.toLowerCase().includes(term) ||
      invoice.buyerName.toLowerCase().includes(term) ||
      invoice.buyerAddress.toLowerCase().includes(term) ||
      (invoice.buyerTaxId && invoice.buyerTaxId.toLowerCase().includes(term))
    );
  });

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-secondary text-secondary-foreground p-4 flex items-center gap-4">
        <Link href="/reports">
          <Button
            variant="ghost"
            size="icon"
            className="text-secondary-foreground hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1">ใบกำกับภาษีเต็ม</h1>
        <FileText className="w-6 h-6" />
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-6xl mx-auto w-full space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="ค้นหาด้วยเลขที่ใบกำกับภาษี, ชื่อผู้ซื้อ, ที่อยู่, หรือเลขประจำตัวผู้เสียภาษี..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">สรุป</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {invoices?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground">ใบกำกับภาษีเต็มทั้งหมด</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-ts-success">
                  {invoices?.filter((inv) => inv.status === "issued").length || 0}
                </p>
                <p className="text-sm text-muted-foreground">ออกแล้ว</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-ts-danger">
                  {invoices?.filter((inv) => inv.status === "cancelled").length || 0}
                </p>
                <p className="text-sm text-muted-foreground">ยกเลิก</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-ts-warning">
                  ฿{formatCurrency(
                    invoices
                      ?.filter((inv) => inv.status === "issued")
                      .reduce((sum, inv) => sum + inv.vatAmount, 0) || 0
                  )}
                </p>
                <p className="text-sm text-muted-foreground">VAT รวม (เฉพาะที่ออกแล้ว)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredInvoices && filteredInvoices.length > 0 ? (
          <div className="space-y-3">
            {filteredInvoices.map((invoice) => (
              <Card 
                key={invoice.id} 
                className={`hover:shadow-md transition-shadow ${
                  invoice.status === "cancelled" ? "border-red-200 bg-red-50/50" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {invoice.status === "cancelled" ? (
                          <XCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <FileText className="w-5 h-5 text-primary" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-lg font-mono">
                              {invoice.invoiceNumber}
                            </p>
                            {invoice.status === "cancelled" && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded">
                                ยกเลิก
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(invoice.issuedDate)}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="text-muted-foreground">ผู้ซื้อ:</span>{" "}
                          <span className="font-medium">{invoice.buyerName}</span>
                        </p>
                        <p className="text-muted-foreground line-clamp-1">
                          {invoice.buyerAddress}
                        </p>
                        {invoice.buyerTaxId && (
                          <p className="text-muted-foreground">
                            เลขประจำตัวผู้เสียภาษี: {invoice.buyerTaxId}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground">ยอดรวม</p>
                        <p className="text-xl font-bold text-primary">
                          ฿{formatCurrency(invoice.totalWithVat)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          VAT: ฿{formatCurrency(invoice.vatAmount)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSelectedInvoice({
                            saleId: invoice.saleId,
                            open: true,
                          })
                        }
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        ดูรายละเอียด
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-semibold mb-2">
                {searchTerm ? "ไม่พบใบกำกับภาษีเต็มที่ค้นหา" : "ยังไม่มีใบกำกับภาษีเต็ม"}
              </p>
              <p className="text-sm text-muted-foreground">
                {searchTerm
                  ? "ลองค้นหาด้วยคำอื่น"
                  : "ใบกำกับภาษีเต็มจะแสดงที่นี่เมื่อมีการออกใบกำกับภาษีเต็ม"}
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Full Tax Invoice Dialog */}
      {selectedInvoice && (
        <FullTaxInvoiceDialog
          saleId={selectedInvoice.saleId}
          open={selectedInvoice.open}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedInvoice(null);
            }
          }}
        />
      )}
    </div>
  );
}
