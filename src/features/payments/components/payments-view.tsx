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
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CancelInvoiceDialog } from "./cancel-invoice-dialog";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { TablePagination } from "@/components/ui/table-pagination";

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

const PAGE_SIZE = 10;

export function PaymentsView({
  invoices,
  payments,
  isOwner,
}: PaymentsViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"invoices" | "payments">(
    "invoices"
  );

  // Invoices filter and pagination state
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>("ALL");
  const [invoiceSortBy, setInvoiceSortBy] = useState<string>("issued-desc");
  const [invoicePage, setInvoicePage] = useState<number>(1);
  const [cancellingInvoice, setCancellingInvoice] = useState<{
    id: string;
    displayNo: string;
  } | null>(null);

  // Payments filter and pagination state
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentKindFilter, setPaymentKindFilter] = useState<string>("ALL");
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>("ALL");
  const [paymentSortBy, setPaymentSortBy] = useState<string>("received-desc");
  const [paymentPage, setPaymentPage] = useState<number>(1);

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

  // Sort Invoices (Default: Latest invoices first based on invoice issue date/time)
  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    if (invoiceSortBy === "issued-desc") {
      return new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime();
    }
    if (invoiceSortBy === "issued-asc") {
      return new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime();
    }
    if (invoiceSortBy === "amount-desc") {
      return b.billAmount - a.billAmount;
    }
    if (invoiceSortBy === "amount-asc") {
      return a.billAmount - b.billAmount;
    }
    if (invoiceSortBy === "balance-desc") {
      return b.balance - a.balance;
    }
    if (invoiceSortBy === "balance-asc") {
      return a.balance - b.balance;
    }
    if (invoiceSortBy === "guest-asc") {
      return a.guestName.localeCompare(b.guestName);
    }
    if (invoiceSortBy === "guest-desc") {
      return b.guestName.localeCompare(a.guestName);
    }
    if (invoiceSortBy === "number-desc") {
      return b.number - a.number;
    }
    if (invoiceSortBy === "number-asc") {
      return a.number - b.number;
    }
    // Default fallback: latest invoices first
    return new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime();
  });

  // Invoices pagination calculation
  const totalInvoiceRecords = sortedInvoices.length;
  const totalInvoicePages = Math.max(1, Math.ceil(totalInvoiceRecords / PAGE_SIZE));
  const safeInvoicePage = Math.min(Math.max(1, invoicePage), totalInvoicePages);
  const paginatedInvoices = sortedInvoices.slice(
    (safeInvoicePage - 1) * PAGE_SIZE,
    safeInvoicePage * PAGE_SIZE
  );

  // Invoices handlers (resets page to 1)
  const handleInvoiceSearchChange = (value: string) => {
    setInvoiceSearch(value);
    setInvoicePage(1);
  };

  const handleInvoiceStatusFilterChange = (value: string) => {
    setInvoiceStatusFilter(value);
    setInvoicePage(1);
  };

  const handleInvoiceSortChange = (value: string) => {
    setInvoiceSortBy(value);
    setInvoicePage(1);
  };

  const toggleInvoiceSort = (
    field: "issued" | "amount" | "balance" | "guest" | "number"
  ) => {
    let nextSort = "";
    if (field === "issued") {
      nextSort = invoiceSortBy === "issued-desc" ? "issued-asc" : "issued-desc";
    } else if (field === "amount") {
      nextSort = invoiceSortBy === "amount-desc" ? "amount-asc" : "amount-desc";
    } else if (field === "balance") {
      nextSort = invoiceSortBy === "balance-desc" ? "balance-asc" : "balance-desc";
    } else if (field === "guest") {
      nextSort = invoiceSortBy === "guest-asc" ? "guest-desc" : "guest-asc";
    } else if (field === "number") {
      nextSort = invoiceSortBy === "number-desc" ? "number-asc" : "number-desc";
    }
    if (nextSort) {
      handleInvoiceSortChange(nextSort);
    }
  };

  const renderInvoiceSortIndicator = (
    field: "issued" | "amount" | "balance" | "guest" | "number"
  ) => {
    if (field === "issued") {
      if (invoiceSortBy === "issued-desc") return <ArrowDownIcon className="size-3 text-primary" />;
      if (invoiceSortBy === "issued-asc") return <ArrowUpIcon className="size-3 text-primary" />;
    } else if (field === "amount") {
      if (invoiceSortBy === "amount-desc") return <ArrowDownIcon className="size-3 text-primary" />;
      if (invoiceSortBy === "amount-asc") return <ArrowUpIcon className="size-3 text-primary" />;
    } else if (field === "balance") {
      if (invoiceSortBy === "balance-desc") return <ArrowDownIcon className="size-3 text-primary" />;
      if (invoiceSortBy === "balance-asc") return <ArrowUpIcon className="size-3 text-primary" />;
    } else if (field === "guest") {
      if (invoiceSortBy === "guest-asc") return <ArrowUpIcon className="size-3 text-primary" />;
      if (invoiceSortBy === "guest-desc") return <ArrowDownIcon className="size-3 text-primary" />;
    } else if (field === "number") {
      if (invoiceSortBy === "number-desc") return <ArrowDownIcon className="size-3 text-primary" />;
      if (invoiceSortBy === "number-asc") return <ArrowUpIcon className="size-3 text-primary" />;
    }
    return <ArrowUpDownIcon className="size-3 opacity-30 group-hover/col:opacity-70 transition-opacity" />;
  };

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

  // Sort Payments (Default: Latest transactions first based on payment received date/time)
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    if (paymentSortBy === "received-desc") {
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    }
    if (paymentSortBy === "received-asc") {
      return new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
    }
    if (paymentSortBy === "amount-desc") {
      return b.amount - a.amount;
    }
    if (paymentSortBy === "amount-asc") {
      return a.amount - b.amount;
    }
    if (paymentSortBy === "guest-asc") {
      return a.guestName.localeCompare(b.guestName);
    }
    if (paymentSortBy === "guest-desc") {
      return b.guestName.localeCompare(a.guestName);
    }
    // Default fallback: latest transactions first
    return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
  });

  // Payments pagination calculation
  const totalPaymentRecords = sortedPayments.length;
  const totalPaymentPages = Math.max(1, Math.ceil(totalPaymentRecords / PAGE_SIZE));
  const safePaymentPage = Math.min(Math.max(1, paymentPage), totalPaymentPages);
  const paginatedPayments = sortedPayments.slice(
    (safePaymentPage - 1) * PAGE_SIZE,
    safePaymentPage * PAGE_SIZE
  );

  // Payments handlers (resets page to 1)
  const handlePaymentSearchChange = (value: string) => {
    setPaymentSearch(value);
    setPaymentPage(1);
  };

  const handlePaymentKindFilterChange = (value: string) => {
    setPaymentKindFilter(value);
    setPaymentPage(1);
  };

  const handlePaymentModeFilterChange = (value: string) => {
    setPaymentModeFilter(value);
    setPaymentPage(1);
  };

  const handlePaymentSortChange = (value: string) => {
    setPaymentSortBy(value);
    setPaymentPage(1);
  };

  const togglePaymentSort = (field: "received" | "amount" | "guest") => {
    let nextSort = "";
    if (field === "received") {
      nextSort = paymentSortBy === "received-desc" ? "received-asc" : "received-desc";
    } else if (field === "amount") {
      nextSort = paymentSortBy === "amount-desc" ? "amount-asc" : "amount-desc";
    } else if (field === "guest") {
      nextSort = paymentSortBy === "guest-asc" ? "guest-desc" : "guest-asc";
    }
    if (nextSort) {
      handlePaymentSortChange(nextSort);
    }
  };

  const renderPaymentSortIndicator = (field: "received" | "amount" | "guest") => {
    if (field === "received") {
      if (paymentSortBy === "received-desc") return <ArrowDownIcon className="size-3 text-primary" />;
      if (paymentSortBy === "received-asc") return <ArrowUpIcon className="size-3 text-primary" />;
    } else if (field === "amount") {
      if (paymentSortBy === "amount-desc") return <ArrowDownIcon className="size-3 text-primary" />;
      if (paymentSortBy === "amount-asc") return <ArrowUpIcon className="size-3 text-primary" />;
    } else if (field === "guest") {
      if (paymentSortBy === "guest-asc") return <ArrowUpIcon className="size-3 text-primary" />;
      if (paymentSortBy === "guest-desc") return <ArrowDownIcon className="size-3 text-primary" />;
    }
    return <ArrowUpDownIcon className="size-3 opacity-30 group-hover/col:opacity-70 transition-opacity" />;
  };

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
            {/* Filter & Sort Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search invoice #, booking, room, or guest..."
                    value={invoiceSearch}
                    onChange={(e) => handleInvoiceSearchChange(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                <div className="w-full sm:w-52">
                  <SelectDropdown
                    value={invoiceSortBy}
                    onChange={handleInvoiceSortChange}
                    options={[
                      { value: "issued-desc", label: "Newest Invoices" },
                      { value: "issued-asc", label: "Oldest Invoices" },
                      { value: "amount-desc", label: "Highest Bill" },
                      { value: "amount-asc", label: "Lowest Bill" },
                      { value: "balance-desc", label: "Highest Balance" },
                      { value: "balance-asc", label: "Lowest Balance" },
                      { value: "guest-asc", label: "Guest Name (A–Z)" },
                      { value: "guest-desc", label: "Guest Name (Z–A)" },
                      { value: "number-desc", label: "Highest Invoice No." },
                      { value: "number-asc", label: "Lowest Invoice No." },
                    ]}
                    size="sm"
                    groupLabel="Sort Invoices"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                {[
                  { id: "ALL", label: "All Invoices" },
                  { id: "ISSUED", label: "Issued" },
                  { id: "CANCELLED", label: "Cancelled" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleInvoiceStatusFilterChange(item.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap",
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
              {totalInvoiceRecords === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No invoices match your search filters.
                </div>
              ) : (
                <div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleInvoiceSort("number")}
                              className="group/col inline-flex items-center gap-1 uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <span>Invoice No</span>
                              {renderInvoiceSortIndicator("number")}
                            </button>
                          </th>
                          <th className="px-4 py-3">Booking Ref</th>
                          <th className="px-4 py-3">Room</th>
                          <th className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleInvoiceSort("guest")}
                              className="group/col inline-flex items-center gap-1 uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <span>Guest Name</span>
                              {renderInvoiceSortIndicator("guest")}
                            </button>
                          </th>
                          <th className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleInvoiceSort("issued")}
                              className="group/col inline-flex items-center gap-1 uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <span>Issued Date</span>
                              {renderInvoiceSortIndicator("issued")}
                            </button>
                          </th>
                          <th className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => toggleInvoiceSort("amount")}
                              className="group/col inline-flex items-center gap-1 uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors ml-auto"
                            >
                              <span>Total Bill</span>
                              {renderInvoiceSortIndicator("amount")}
                            </button>
                          </th>
                          <th className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => toggleInvoiceSort("balance")}
                              className="group/col inline-flex items-center gap-1 uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors ml-auto"
                            >
                              <span>Balance Due</span>
                              {renderInvoiceSortIndicator("balance")}
                            </button>
                          </th>
                          <th className="px-4 py-3 text-center">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {paginatedInvoices.map((inv) => (
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
                              className={`px-4 py-3 text-right font-mono font-semibold ${inv.balance > 0
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

                  {/* Invoices Pagination */}
                  <TablePagination
                    currentPage={safeInvoicePage}
                    totalRecords={totalInvoiceRecords}
                    pageSize={PAGE_SIZE}
                    onPageChange={(page) => setInvoicePage(page)}
                    recordLabel="invoices"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Payments */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            {/* Filters & Sort Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search booking ref, room, or guest..."
                    value={paymentSearch}
                    onChange={(e) => handlePaymentSearchChange(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                <div className="w-full sm:w-52">
                  <SelectDropdown
                    value={paymentSortBy}
                    onChange={handlePaymentSortChange}
                    options={[
                      { value: "received-desc", label: "Latest Payments First" },
                      { value: "received-asc", label: "Oldest Payments First" },
                      { value: "amount-desc", label: "Amount (High to Low)" },
                      { value: "amount-asc", label: "Amount (Low to High)" },
                      { value: "guest-asc", label: "Guest Name (A–Z)" },
                      { value: "guest-desc", label: "Guest Name (Z–A)" },
                    ]}
                    size="sm"
                    groupLabel="Sort Payments"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-full sm:w-36">
                  <SelectDropdown
                    value={paymentKindFilter}
                    onChange={handlePaymentKindFilterChange}
                    options={[
                      { value: "ALL", label: "All Types" },
                      { value: "ADVANCE", label: "Advance" },
                      { value: "PAYMENT", label: "Stay Payment" },
                      { value: "REFUND", label: "Refund" },
                    ]}
                    size="sm"
                    groupLabel="Filter by Type"
                  />
                </div>

                <div className="w-full sm:w-36">
                  <SelectDropdown
                    value={paymentModeFilter}
                    onChange={handlePaymentModeFilterChange}
                    options={[
                      { value: "ALL", label: "All Modes" },
                      { value: "UPI", label: "UPI" },
                      { value: "CASH", label: "Cash" },
                      { value: "CARD", label: "Card" },
                      { value: "BANK_TRANSFER", label: "Bank Transfer" },
                    ]}
                    size="sm"
                    groupLabel="Filter by Mode"
                  />
                </div>
              </div>
            </div>

            {/* Payments Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              {totalPaymentRecords === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No payment records match your filters.
                </div>
              ) : (
                <div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => togglePaymentSort("received")}
                              className="group/col inline-flex items-center gap-1 uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <span>Received At</span>
                              {renderPaymentSortIndicator("received")}
                            </button>
                          </th>
                          <th className="px-4 py-3">Booking Ref</th>
                          <th className="px-4 py-3">Room</th>
                          <th className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => togglePaymentSort("guest")}
                              className="group/col inline-flex items-center gap-1 uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <span>Guest Name</span>
                              {renderPaymentSortIndicator("guest")}
                            </button>
                          </th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Mode</th>
                          <th className="px-4 py-3">Note / Details</th>
                          <th className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => togglePaymentSort("amount")}
                              className="group/col inline-flex items-center gap-1 uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors ml-auto"
                            >
                              <span>Amount</span>
                              {renderPaymentSortIndicator("amount")}
                            </button>
                          </th>
                          <th className="px-4 py-3 text-right">Invoice</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {paginatedPayments.map((pmt) => (
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
                              className={`px-4 py-3 text-right font-mono font-bold ${pmt.kind === "REFUND"
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

                  {/* Payments Pagination */}
                  <TablePagination
                    currentPage={safePaymentPage}
                    totalRecords={totalPaymentRecords}
                    pageSize={PAGE_SIZE}
                    onPageChange={(page) => setPaymentPage(page)}
                    recordLabel="payments"
                  />
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
