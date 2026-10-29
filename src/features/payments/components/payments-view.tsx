"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatISTDateTime } from "@/lib/datetime";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  PaymentIcon,
  InvoiceIcon,
  SearchIcon,
  DownloadIcon,
  RupeeIcon,
  ProblemIcon,
} from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CancelInvoiceDialog } from "./cancel-invoice-dialog";

interface InvoiceItem {
  id: string;
  number: number;
  displayNo: string;
  status: "ISSUED" | "CANCELLED";
  issuedAt: Date;
  billAmount: number;
  balance: number;
  bookingId: string;
  bookingRef: string;
  roomNumber: string;
  roomTypeName: string;
  guestName: string;
}

interface PaymentItem {
  id: string;
  kind: "ADVANCE" | "PAYMENT" | "REFUND";
  mode: "CASH" | "UPI" | "CARD" | "BANK_TRANSFER";
  amount: number;
  note: string | null;
  receivedAt: Date;
  bookingId: string;
  bookingRef: string;
  roomNumber: string;
  guestName: string;
  invoiceDisplayNo: string | null;
  invoiceId: string | null;
}

interface PaymentsViewProps {
  invoices: InvoiceItem[];
  payments: PaymentItem[];
  isOwner: boolean;
}

export function PaymentsView({
  invoices,
  payments,
  isOwner,
}: PaymentsViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"invoices" | "payments">(
    "invoices"
  );

  // Invoices filter state
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>("ALL");
  const [cancellingInvoice, setCancellingInvoice] = useState<{
    id: string;
    displayNo: string;
  } | null>(null);

  // Payments filter state
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentKindFilter, setPaymentKindFilter] = useState<string>("ALL");
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>("ALL");

  // Filter Invoices
  const filteredInvoices = invoices.filter((inv) => {
    if (invoiceStatusFilter !== "ALL" && inv.status !== invoiceStatusFilter)
      return false;
    if (invoiceSearch.trim()) {
      const q = invoiceSearch.toLowerCase().trim();
      const matchNo = inv.displayNo.toLowerCase().includes(q);
      const matchRef = inv.bookingRef.toLowerCase().includes(q);
      const matchRoom = inv.roomNumber.toLowerCase().includes(q);
      const matchGuest = inv.guestName.toLowerCase().includes(q);
      if (!matchNo && !matchRef && !matchRoom && !matchGuest) return false;
    }
    return true;
  });

  // Filter Payments
  const filteredPayments = payments.filter((pmt) => {
    if (paymentKindFilter !== "ALL" && pmt.kind !== paymentKindFilter)
      return false;
    if (paymentModeFilter !== "ALL" && pmt.mode !== paymentModeFilter)
      return false;
    if (paymentSearch.trim()) {
      const q = paymentSearch.toLowerCase().trim();
      const matchRef = pmt.bookingRef.toLowerCase().includes(q);
      const matchRoom = pmt.roomNumber.toLowerCase().includes(q);
      const matchGuest = pmt.guestName.toLowerCase().includes(q);
      if (!matchRef && !matchRoom && !matchGuest) return false;
    }
    return true;
  });

  // Metric Totals
  const totalBilled = invoices
    .filter((inv) => inv.status === "ISSUED")
    .reduce((sum, inv) => sum + inv.billAmount, 0);

  const totalCollected = payments
    .filter((p) => p.kind !== "REFUND")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalRefunded = payments
    .filter((p) => p.kind === "REFUND")
    .reduce((sum, p) => sum + p.amount, 0);

  const netCollected = totalCollected - totalRefunded;

  const totalOutstandingBalance = invoices
    .filter((inv) => inv.status === "ISSUED" && inv.balance > 0)
    .reduce((sum, inv) => sum + inv.balance, 0);

  return (
    <div className="space-y-6">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-border shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Total Invoices Billed</span>
            <InvoiceIcon className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-foreground">
            {formatINR(totalBilled)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {invoices.filter((i) => i.status === "ISSUED").length} active tax
            invoices
          </p>
        </Card>

        <Card className="p-4 bg-card border-border shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Net Collected</span>
            <PaymentIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {formatINR(netCollected)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Advances & stay settlements
          </p>
        </Card>

        <Card className="p-4 bg-card border-border shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Pending Balance Due</span>
            <RupeeIcon className="size-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {formatINR(totalOutstandingBalance)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Unsettled checkout balances
          </p>
        </Card>

        <Card className="p-4 bg-card border-border shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Refunds Issued</span>
            <ProblemIcon className="size-4 text-red-500" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-red-600 dark:text-red-400">
            {formatINR(totalRefunded)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {payments.filter((p) => p.kind === "REFUND").length} refund
            transactions
          </p>
        </Card>
      </div>

      {/* Main Tab Controller & Filters */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-border gap-4 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className={cn(
              "pb-2 text-sm font-semibold border-b-2 -mb-2.5 transition-colors flex items-center gap-2",
              activeTab === "invoices"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <InvoiceIcon className="size-4" />
            Tax Invoices ({invoices.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("payments")}
            className={cn(
              "pb-2 text-sm font-semibold border-b-2 -mb-2.5 transition-colors flex items-center gap-2",
              activeTab === "payments"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <PaymentIcon className="size-4" />
            Payment Transactions ({payments.length})
          </button>
        </div>

        {/* Tab 1: Invoices */}
        {activeTab === "invoices" && (
          <div className="space-y-4">
            {/* Filter Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoice #, booking, room, or guest..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: "ALL", label: "All Invoices" },
                  { id: "ISSUED", label: "Issued" },
                  { id: "CANCELLED", label: "Cancelled" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setInvoiceStatusFilter(item.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                      invoiceStatusFilter === item.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Invoices Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              {filteredInvoices.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No invoices match your search filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Invoice No</th>
                        <th className="px-4 py-3">Booking Ref</th>
                        <th className="px-4 py-3">Room</th>
                        <th className="px-4 py-3">Guest Name</th>
                        <th className="px-4 py-3">Issued Date</th>
                        <th className="px-4 py-3 text-right">Total Bill</th>
                        <th className="px-4 py-3 text-right">Balance Due</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono font-bold text-primary">
                            {inv.displayNo}
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold">
                            <Link
                              href={`/bookings/${inv.bookingId}`}
                              className="hover:underline"
                            >
                              {inv.bookingRef}
                            </Link>
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {inv.roomNumber} ({inv.roomTypeName})
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {inv.guestName}
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            {formatISTDateTime(inv.issuedAt)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">
                            {formatINR(inv.billAmount)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono font-semibold ${
                              inv.balance > 0
                                ? "text-red-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {formatINR(inv.balance)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {inv.status === "ISSUED" ? (
                              <Badge className="bg-emerald-600 text-white text-[10px]">
                                ISSUED
                              </Badge>
                            ) : (
                              <Badge
                                variant="destructive"
                                className="text-[10px]"
                              >
                                CANCELLED
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={`/api/invoices/${inv.id}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className={cn(
                                  buttonVariants({
                                    variant: "outline",
                                    size: "sm",
                                  }),
                                  "h-7 px-2 text-xs"
                                )}
                              >
                                <DownloadIcon className="size-3 mr-1" />
                                PDF
                              </a>
                              {isOwner && inv.status === "ISSUED" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setCancellingInvoice({
                                      id: inv.id,
                                      displayNo: inv.displayNo,
                                    })
                                  }
                                  className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Payments */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search booking ref, room, or guest..."
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={paymentKindFilter}
                  onChange={(e) => setPaymentKindFilter(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                >
                  <option value="ALL">All Types</option>
                  <option value="ADVANCE">Advance</option>
                  <option value="PAYMENT">Stay Payment</option>
                  <option value="REFUND">Refund</option>
                </select>

                <select
                  value={paymentModeFilter}
                  onChange={(e) => setPaymentModeFilter(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                >
                  <option value="ALL">All Modes</option>
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>
            </div>

            {/* Payments Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              {filteredPayments.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No payment records match your filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Received At</th>
                        <th className="px-4 py-3">Booking Ref</th>
                        <th className="px-4 py-3">Room</th>
                        <th className="px-4 py-3">Guest Name</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Mode</th>
                        <th className="px-4 py-3">Note / Details</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-right">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredPayments.map((pmt) => (
                        <tr key={pmt.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            {formatISTDateTime(pmt.receivedAt)}
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold">
                            <Link
                              href={`/bookings/${pmt.bookingId}`}
                              className="hover:underline text-primary"
                            >
                              {pmt.bookingRef}
                            </Link>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold">
                            {pmt.roomNumber}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {pmt.guestName}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                pmt.kind === "REFUND"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {pmt.kind}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-mono font-medium">
                            {pmt.mode}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-[11px]">
                            {pmt.note || "—"}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono font-bold ${
                              pmt.kind === "REFUND"
                                ? "text-red-600 dark:text-red-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {pmt.kind === "REFUND"
                              ? `-${formatINR(pmt.amount)}`
                              : formatINR(pmt.amount)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {pmt.invoiceId ? (
                              <a
                                href={`/api/invoices/${pmt.invoiceId}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-primary hover:underline font-semibold"
                              >
                                {pmt.invoiceDisplayNo}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {cancellingInvoice && (
        <CancelInvoiceDialog
          invoiceId={cancellingInvoice.id}
          displayNo={cancellingInvoice.displayNo}
          open={!!cancellingInvoice}
          onOpenChange={(isOpen) => {
            if (!isOpen) setCancellingInvoice(null);
          }}
          onSuccess={() => {
            setCancellingInvoice(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
