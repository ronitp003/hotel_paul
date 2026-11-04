"use client";

import { useState, useTransition } from "react";
import { NewBookingButton } from "./new-booking-button";
import { formatISTDateTime } from "@/lib/datetime";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  RoomIcon,
  CalendarIcon,
  SearchIcon,
  CheckOutIcon,
  DownloadIcon,
  SpinnerIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { TablePagination } from "@/components/ui/table-pagination";
import type { BookingStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getBookingInvoiceAction } from "@/server/actions/invoice.actions";
import { CheckoutDialog } from "./checkout-dialog";

export interface BookingRow {
  id: string;
  reference: string;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  status: BookingStatus;
  source: string;
  checkInAt: Date;
  checkOutAt: Date;
  actualCheckInAt: Date | null;
  actualCheckOutAt: Date | null;
  guestName: string;
  guestMobile: string | null;
  rateApplied: number;
  advancePaid: number;
  createdAt?: Date;
  groupBookingId?: string | null;
  isGroupMaster?: boolean;
  groupRoomNumbers?: string[];
  groupRoomCount?: number;
  invoiceId?: string | null;
  invoiceDisplayNo?: string | null;
}

interface BookingsTableProps {
  initialBookings: BookingRow[];
  total: number;
}

const PAGE_SIZE = 10;

export function BookingsTable({ initialBookings, total }: BookingsTableProps) {
  const router = useRouter();
  const [prevInitialBookings, setPrevInitialBookings] = useState(initialBookings);
  const [bookings, setBookings] = useState<BookingRow[]>(initialBookings);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("created-desc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [checkoutTarget, setCheckoutTarget] = useState<{
    id: string;
    reference: string;
    roomNumber: string;
  } | null>(null);
  const [isProcessingCheckoutId, setIsProcessingCheckoutId] = useState<string | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [isPendingRefresh, startRefreshTransition] = useTransition();

  if (initialBookings !== prevInitialBookings) {
    setPrevInitialBookings(initialBookings);
    setBookings(initialBookings);
  }

  const handleCheckoutSuccess = (result: { invoiceId: string; displayNo: string }) => {
    if (!checkoutTarget) return;
    const targetId = checkoutTarget.id;

    // Immediately transition the booking(s) to CHECKED_OUT with the invoice
    setBookings((prev) => {
      const targetBooking = prev.find((x) => x.id === targetId);
      return prev.map((b) => {
        const isTarget = b.id === targetId;
        const isGroupSibling =
          b.groupBookingId && targetBooking?.groupBookingId === b.groupBookingId;

        if (isTarget || isGroupSibling) {
          return {
            ...b,
            status: "CHECKED_OUT" as BookingStatus,
            actualCheckOutAt: new Date(),
            invoiceId: result.invoiceId,
            invoiceDisplayNo: result.displayNo,
          };
        }
        return b;
      });
    });

    setCheckoutTarget(null);
    setIsProcessingCheckoutId(null);
    startRefreshTransition(() => {
      router.refresh();
    });
  };

  const handleDownloadInvoice = async (booking: BookingRow) => {
    if (downloadingInvoiceId) return;

    setDownloadingInvoiceId(booking.id);
    try {
      let invoiceId = booking.invoiceId;
      let displayNo = booking.invoiceDisplayNo;

      if (!invoiceId) {
        const res = await getBookingInvoiceAction(booking.id);
        if (!res.ok || !res.data) {
          toast.error("Invoice is not available yet for this booking.");
          return;
        }
        invoiceId = res.data.id;
        displayNo = res.data.displayNo;
      }

      const response = await fetch(`/api/invoices/${invoiceId}/pdf`);
      if (!response.ok) {
        throw new Error(`Invoice download failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Invoice-${displayNo || booking.reference}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        displayNo
          ? `Invoice ${displayNo} downloaded successfully.`
          : "Invoice downloaded successfully."
      );
    } catch (err) {
      console.error("Failed to download invoice:", err);
      toast.error("Failed to download invoice. Please try again.");
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const handleRowClick = (
    e: React.MouseEvent<HTMLTableRowElement>,
    bookingId: string
  ) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "button, a, input, select, textarea, [data-prevent-row-click]"
      )
    ) {
      return;
    }
    router.push(`/bookings/${bookingId}`);
  };

  const handleRowKeyDown = (
    e: React.KeyboardEvent<HTMLTableRowElement>,
    bookingId: string
  ) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/bookings/${bookingId}`);
    }
  };

  // Filter bookings
  const filtered = bookings.filter((b) => {
    if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchRef = b.reference.toLowerCase().includes(q);
      const matchRoom =
        b.roomNumber.toLowerCase().includes(q) ||
        (b.groupRoomNumbers &&
          b.groupRoomNumbers.some((rn) => rn.toLowerCase().includes(q)));
      const matchGuest = b.guestName.toLowerCase().includes(q);
      if (!matchRef && !matchRoom && !matchGuest) return false;
    }
    return true;
  });

  // Sort bookings (Default: latest bookings first based on booking creation date/time)
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "created-desc") {
      const aTime = a.createdAt
        ? new Date(a.createdAt).getTime()
        : new Date(a.checkInAt).getTime();
      const bTime = b.createdAt
        ? new Date(b.createdAt).getTime()
        : new Date(b.checkInAt).getTime();
      return bTime - aTime;
    }
    if (sortBy === "created-asc") {
      const aTime = a.createdAt
        ? new Date(a.createdAt).getTime()
        : new Date(a.checkInAt).getTime();
      const bTime = b.createdAt
        ? new Date(b.createdAt).getTime()
        : new Date(b.checkInAt).getTime();
      return aTime - bTime;
    }
    if (sortBy === "checkin-desc") {
      return new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime();
    }
    if (sortBy === "checkin-asc") {
      return new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime();
    }
    if (sortBy === "guest-asc") {
      return a.guestName.localeCompare(b.guestName);
    }
    if (sortBy === "guest-desc") {
      return b.guestName.localeCompare(a.guestName);
    }
    if (sortBy === "tariff-desc") {
      return b.rateApplied - a.rateApplied;
    }
    if (sortBy === "tariff-asc") {
      return a.rateApplied - b.rateApplied;
    }
    if (sortBy === "advance-desc") {
      return b.advancePaid - a.advancePaid;
    }
    if (sortBy === "advance-asc") {
      return a.advancePaid - b.advancePaid;
    }
    // Default fallback: latest bookings first based on booking creation date/time
    const aTime = a.createdAt
      ? new Date(a.createdAt).getTime()
      : new Date(a.checkInAt).getTime();
    const bTime = b.createdAt
      ? new Date(b.createdAt).getTime()
      : new Date(b.checkInAt).getTime();
    return bTime - aTime;
  });

  // Pagination calculation
  const totalRecords = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedBookings = sorted.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setCurrentPage(1);
  };

  const toggleSort = (field: "checkin" | "guest" | "tariff" | "advance" | "created") => {
    let nextSort = "";
    if (field === "created") {
      nextSort = sortBy === "created-desc" ? "created-asc" : "created-desc";
    } else if (field === "checkin") {
      nextSort = sortBy === "checkin-desc" ? "checkin-asc" : "checkin-desc";
    } else if (field === "guest") {
      nextSort = sortBy === "guest-asc" ? "guest-desc" : "guest-asc";
    } else if (field === "tariff") {
      nextSort = sortBy === "tariff-desc" ? "tariff-asc" : "tariff-desc";
    } else if (field === "advance") {
      nextSort = sortBy === "advance-desc" ? "advance-asc" : "advance-desc";
    }
    if (nextSort) {
      handleSortChange(nextSort);
    }
  };

  const renderSortIndicator = (field: "checkin" | "guest" | "tariff" | "advance" | "created") => {
    if (field === "created") {
      if (sortBy === "created-desc") return <ArrowDownIcon className="size-3 text-primary" />;
      if (sortBy === "created-asc") return <ArrowUpIcon className="size-3 text-primary" />;
    } else if (field === "checkin") {
      if (sortBy === "checkin-desc") return <ArrowDownIcon className="size-3 text-primary" />;
      if (sortBy === "checkin-asc") return <ArrowUpIcon className="size-3 text-primary" />;
    } else if (field === "guest") {
      if (sortBy === "guest-asc") return <ArrowUpIcon className="size-3 text-primary" />;
      if (sortBy === "guest-desc") return <ArrowDownIcon className="size-3 text-primary" />;
    } else if (field === "tariff") {
      if (sortBy === "tariff-desc") return <ArrowDownIcon className="size-3 text-primary" />;
      if (sortBy === "tariff-asc") return <ArrowUpIcon className="size-3 text-primary" />;
    } else if (field === "advance") {
      if (sortBy === "advance-desc") return <ArrowDownIcon className="size-3 text-primary" />;
      if (sortBy === "advance-asc") return <ArrowUpIcon className="size-3 text-primary" />;
    }
    return <ArrowUpDownIcon className="size-3 opacity-30 group-hover/col:opacity-70 transition-opacity" />;
  };

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case "CHECKED_IN":
        return (
          <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-medium text-xs">
            Occupied / Checked-In
          </Badge>
        );
      case "RESERVED":
        return (
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-medium text-xs">
            Reserved
          </Badge>
        );
      case "CHECKED_OUT":
        return (
          <Badge className="bg-slate-500 hover:bg-slate-500 text-white font-medium text-xs">
            Checked Out
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 text-xs"
          >
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Sort Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by reference, room, or guest..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <div className="w-full sm:w-52">
            <SelectDropdown
              value={sortBy}
              onChange={handleSortChange}
              options={[
                { value: "created-desc", label: "Latest Bookings First" },
                { value: "created-asc", label: "Oldest Bookings First" },
                { value: "checkin-desc", label: "Check-in (Latest First)" },
                { value: "checkin-asc", label: "Check-in (Earliest First)" },
                { value: "guest-asc", label: "Guest Name (A–Z)" },
                { value: "guest-desc", label: "Guest Name (Z–A)" },
                { value: "tariff-desc", label: "Tariff (High to Low)" },
                { value: "tariff-asc", label: "Tariff (Low to High)" },
                { value: "advance-desc", label: "Advance (High to Low)" },
                { value: "advance-asc", label: "Advance (Low to High)" },
              ]}
              size="sm"
              groupLabel="Sort Bookings"
            />
          </div>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {[
            { id: "ALL", label: "All Stays" },
            { id: "CHECKED_IN", label: "Checked In" },
            { id: "RESERVED", label: "Reservations" },
            { id: "CHECKED_OUT", label: "Checked Out" },
            { id: "CANCELLED", label: "Cancelled" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleStatusFilterChange(item.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap",
                statusFilter === item.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count Indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing {totalRecords} matching stay{totalRecords === 1 ? "" : "s"} of {total} total record(s)
          {totalPages > 1 && ` • Page ${safePage} of ${totalPages}`}
        </span>
      </div>

      {/* Bookings List / Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-xs">
        {totalRecords === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="size-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
              <CalendarIcon className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                No bookings found
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {search || statusFilter !== "ALL"
                  ? "No bookings match the selected filters. Try clearing your search query."
                  : "There are no bookings recorded yet. Create a new reservation or check in a walk-in guest."}
              </p>
            </div>
            <NewBookingButton size="sm" className="mt-2">
              Create New Booking
            </NewBookingButton>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("guest")}
                        className="group/col inline-flex items-center gap-1 uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span>Primary Guest</span>
                        {renderSortIndicator("guest")}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("checkin")}
                        className="group/col inline-flex items-center gap-1 uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span>Check-in / Check-out</span>
                        {renderSortIndicator("checkin")}
                      </button>
                    </th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort("tariff")}
                        className="group/col inline-flex items-center gap-1 uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors ml-auto"
                      >
                        <span>Tariff</span>
                        {renderSortIndicator("tariff")}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort("advance")}
                        className="group/col inline-flex items-center gap-1 uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors ml-auto"
                      >
                        <span>Advance Paid</span>
                        {renderSortIndicator("advance")}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedBookings.map((b) => (
                    <tr
                      key={b.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`View booking for ${b.guestName}, Room ${b.roomNumber}`}
                      onClick={(e) => handleRowClick(e, b.id)}
                      onKeyDown={(e) => handleRowKeyDown(e, b.id)}
                      className="cursor-pointer transition-colors duration-150 hover:bg-primary-subtle dark:hover:bg-primary-subtle/40 focus-visible:outline-none focus-visible:bg-primary-subtle"
                    >
                      <td className="px-4 py-3">
                        {b.groupBookingId && b.groupRoomNumbers && b.groupRoomNumbers.length > 1 ? (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <RoomIcon className="size-3.5 text-primary shrink-0" />
                              <div className="flex flex-wrap gap-1 items-center">
                                {b.groupRoomNumbers.map((rn) => (
                                  <Badge
                                    key={rn}
                                    variant="outline"
                                    className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-muted/60 text-foreground border-border"
                                  >
                                    {rn}
                                  </Badge>
                                ))}
                              </div>
                              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                Group ({b.groupRoomCount || b.groupRoomNumbers.length})
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground pl-5">
                              {b.groupRoomCount || b.groupRoomNumbers.length} rooms • {b.roomTypeName}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <RoomIcon className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="font-bold text-foreground font-mono">
                              {b.roomNumber}
                            </span>
                            <span className="text-muted-foreground">
                              ({b.roomTypeName})
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {b.guestName}
                          </span>
                          {b.guestMobile && (
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {b.guestMobile}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col font-mono text-[11px]">
                          <span>In: {formatISTDateTime(b.checkInAt)}</span>
                          <span className="text-muted-foreground">
                            Out: {formatISTDateTime(b.checkOutAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(b.status)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        <div>
                          <span>{formatINR(b.rateApplied)}</span>
                          {b.groupRoomCount && b.groupRoomCount > 1 && (
                            <span className="block text-[10px] text-muted-foreground font-sans font-normal">
                              Total
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        <div>
                          <span>{b.advancePaid > 0 ? formatINR(b.advancePaid) : "—"}</span>
                          {b.groupRoomCount && b.groupRoomCount > 1 && b.advancePaid > 0 && (
                            <span className="block text-[10px] text-muted-foreground font-sans font-normal">
                              Group total
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {b.status === "CHECKED_IN" ? (
                            <Button
                              variant="default"
                              size="sm"
                              disabled={isProcessingCheckoutId === b.id || isPendingRefresh}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCheckoutTarget({
                                  id: b.id,
                                  reference: b.reference,
                                  roomNumber:
                                    b.groupRoomNumbers?.join(", ") || b.roomNumber,
                                });
                              }}
                              className="h-7 px-2.5 text-xs font-semibold min-w-[85px] inline-flex items-center justify-center gap-1"
                            >
                              {isProcessingCheckoutId === b.id || (isPendingRefresh && checkoutTarget?.id === b.id) ? (
                                <>
                                  <SpinnerIcon className="size-3 animate-spin shrink-0" />
                                  <span>Processing...</span>
                                </>
                              ) : (
                                <>
                                  <CheckOutIcon className="size-3 shrink-0" />
                                  <span>Check Out</span>
                                </>
                              )}
                            </Button>
                          ) : b.status === "CHECKED_OUT" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!b.invoiceId || !!downloadingInvoiceId}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadInvoice(b);
                              }}
                              title={
                                b.invoiceId
                                  ? `Invoice ${b.invoiceDisplayNo || ""}`
                                  : "Invoice"
                              }
                              className={cn(
                                "h-7 px-2.5 text-xs font-medium inline-flex items-center gap-1.5",
                                b.invoiceId &&
                                  "hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors"
                              )}
                            >
                              {downloadingInvoiceId === b.id ? (
                                <>
                                  <SpinnerIcon className="size-3 animate-spin shrink-0" />
                                  <span>Downloading...</span>
                                </>
                              ) : (
                                <>
                                  <DownloadIcon className="size-3.5 shrink-0" />
                                  <span>Invoice</span>
                                </>
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <TablePagination
              currentPage={safePage}
              totalRecords={totalRecords}
              pageSize={PAGE_SIZE}
              onPageChange={(page) => setCurrentPage(page)}
              recordLabel="bookings"
            />
          </div>
        )}
      </div>

      {checkoutTarget && (
        <CheckoutDialog
          bookingId={checkoutTarget.id}
          bookingRef={checkoutTarget.reference}
          roomNumber={checkoutTarget.roomNumber}
          open={!!checkoutTarget}
          onProcessingChange={(busy) => {
            setIsProcessingCheckoutId(busy ? checkoutTarget.id : null);
          }}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setCheckoutTarget(null);
              setIsProcessingCheckoutId(null);
            }
          }}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </div>
  );
}
