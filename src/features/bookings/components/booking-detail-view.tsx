"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatISTDateTime } from "@/lib/datetime";
import { formatINR, formatINRPlain } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  GuestIcon,
  RupeeIcon,
  CheckInIcon,
  CheckOutIcon,
  CloseIcon,
  AddIcon,
  DeleteIcon,
  DownloadIcon,
  PrintIcon,
  PaymentIcon,
  ChevronRightIcon,
} from "@/lib/icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckoutDialog } from "./checkout-dialog";
import { AddChargeDialog } from "./add-charge-dialog";
import { AddPaymentDialog } from "./add-payment-dialog";
import { CheckInConfirmDialog } from "./checkin-confirm-dialog";
import { CancelBookingDialog } from "./cancel-booking-dialog";
import { EditStayDatesDialog } from "./edit-stay-dates-dialog";
import { deleteChargeAction } from "@/server/actions/billing.actions";
import { toast } from "sonner";
import type { BookingBillSummary } from "@/server/services/booking.service";

export interface BookingDetailData {
  id: string;
  reference: string;
  status: "RESERVED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
  source: string;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  checkInAt: Date;
  checkOutAt: Date;
  actualCheckInAt: Date | null;
  actualCheckOutAt: Date | null;
  arrivingFrom: string | null;
  purposeOfVisit: string | null;
  companyName: string | null;
  companyGstin: string | null;
  companyAddress: string | null;
  rateApplied: number;
  discount: number;
  gstPercentOverride: number | null;
  effectiveGstPercent: number;
  stayDays: number;
  roomCharges: number;
  taxableAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  totalAmount: number;
  totalPaid: number;
  balanceDue: number;
  guests: Array<{
    id: string;
    name: string;
    fatherName: string | null;
    age: number | null;
    sex: string | null;
    mobile: string | null;
    isPrimary: boolean;
  }>;
  payments: Array<{
    id: string;
    kind: "ADVANCE" | "PAYMENT" | "REFUND";
    mode: string;
    amount: number;
    note: string | null;
    receivedAt: Date;
  }>;
  charges: Array<{
    id: string;
    description: string;
    amount: number;
    isTaxable: boolean;
    createdAt: Date;
  }>;
  invoice: {
    id: string;
    number: number;
    displayNo: string;
    status: string;
    issuedAt: Date;
  } | null;
  groupBookingId?: string | null;
  isGroupMaster?: boolean;
  groupRooms?: Array<{
    id: string;
    reference: string;
    roomId: string;
    roomNumber: string;
    roomTypeName: string;
    status: string;
    rateApplied: number;
    stayDays?: number;
    roomCharge?: number;
    isGroupMaster: boolean;
    guests: Array<{
      name: string;
      isPrimary: boolean;
    }>;
  }>;
  groupBill?: BookingBillSummary | null;
}

interface BookingDetailViewProps {
  booking: BookingDetailData;
}

export function BookingDetailView({ booking }: BookingDetailViewProps) {
  const router = useRouter();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentKind, setPaymentKind] = useState<"PAYMENT" | "ADVANCE">(
    "PAYMENT"
  );
  const [checkInConfirmOpen, setCheckInConfirmOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [editDatesOpen, setEditDatesOpen] = useState(false);
  const [deletingChargeId, setDeletingChargeId] = useState<string | null>(null);

  const isCheckedIn = booking.status === "CHECKED_IN";
  const isCheckedOut = booking.status === "CHECKED_OUT";
  const isReserved = booking.status === "RESERVED";
  const isGroup = Boolean(
    booking.groupBookingId &&
      booking.groupRooms &&
      booking.groupRooms.length > 1
  );
  const primaryGuestName =
    booking.guests.find((g) => g.isPrimary)?.name ||
    booking.guests[0]?.name ||
    "Guest";

  const handleDeleteCharge = async (chargeId: string) => {
    if (!confirm("Are you sure you want to remove this charge?")) return;
    setDeletingChargeId(chargeId);
    try {
      const res = await deleteChargeAction({ chargeId });
      if (res.ok) {
        toast.success("Charge removed.");
        router.refresh();
      } else {
        toast.error(res.message || "Failed to remove charge.");
      }
    } catch {
      toast.error("Failed to delete charge.");
    } finally {
      setDeletingChargeId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CHECKED_IN":
        return (
          <Badge className="bg-blue-600 text-white">
            Occupied / Checked-In
          </Badge>
        );
      case "RESERVED":
        return <Badge className="bg-amber-500 text-white">Reserved</Badge>;
      case "CHECKED_OUT":
        return <Badge className="bg-slate-500 text-white">Checked Out</Badge>;
      case "CANCELLED":
        return (
          <Badge variant="outline" className="text-red-600 border-red-300">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          href="/bookings"
          className="hover:text-foreground transition-colors"
        >
          Bookings
        </Link>
        <ChevronRightIcon className="size-3" />
        <span className="font-mono text-foreground font-semibold">
          {booking.reference}
        </span>
      </div>

      {/* Top Banner / Actions */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {booking.reference}
            </h1>
            {getStatusBadge(booking.status)}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <span>
              Room <strong>{booking.roomNumber}</strong> ({booking.roomTypeName}
              )
            </span>
            <span>•</span>
            <span>
              {formatISTDateTime(booking.checkInAt)} →{" "}
              {formatISTDateTime(booking.checkOutAt)}
            </span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {isCheckedIn && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setChargeOpen(true)}
                className="text-xs"
              >
                <AddIcon className="size-3.5 mr-1.5" />
                Add Charge
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPaymentKind("PAYMENT");
                  setPaymentOpen(true);
                }}
                className="text-xs"
              >
                <PaymentIcon className="size-3.5 mr-1.5" />
                Record Payment
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setCheckoutOpen(true)}
                className="text-xs font-semibold"
              >
                <CheckOutIcon className="size-3.5 mr-1.5" />
                Check Out & Issue Invoice
              </Button>
            </>
          )}

          {isReserved && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={() => setCheckInConfirmOpen(true)}
                className="text-xs font-semibold"
              >
                <CheckInIcon className="size-3.5 mr-1.5" />
                Check In Guest
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPaymentKind("ADVANCE");
                  setPaymentOpen(true);
                }}
                className="text-xs"
              >
                <PaymentIcon className="size-3.5 mr-1.5" />
                Record Advance
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelDialogOpen(true)}
                className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <CloseIcon className="size-3.5 mr-1.5" />
                Cancel Reservation
              </Button>
            </>
          )}

          {isCheckedOut && booking.invoice && (
            <a
              href={`/api/invoices/${booking.invoice.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "text-xs font-semibold"
              )}
            >
              <DownloadIcon className="size-3.5 mr-1.5" />
              Download Tax Invoice (PDF)
            </a>
          )}
        </div>
      </div>

      {/* Consolidated Group Rooms & Pricing (when group booking) */}
      {isGroup && booking.groupRooms && (
        <Card className="p-5 border-primary/30 bg-primary/5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary text-primary-foreground">
                Group Booking ({booking.groupRooms.length} Rooms)
              </span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {booking.groupBookingId}
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              Consolidated view of all rooms & individual prices • Unified checkout available
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Room</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Tariff / Night</th>
                  <th className="py-2.5 px-3 text-center">Nights</th>
                  <th className="py-2.5 px-3 text-right">Room Charge</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {booking.groupRooms.map((gr) => {
                  const isViewing = gr.id === booking.id;
                  const nights = gr.stayDays ?? booking.stayDays;
                  const charge = gr.roomCharge ?? gr.rateApplied * nights;
                  return (
                    <tr
                      key={gr.id}
                      className={cn(
                        "transition-colors",
                        isViewing
                          ? "bg-primary/10 font-medium"
                          : "hover:bg-muted/30"
                      )}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground text-sm">
                            Room {gr.roomNumber}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            ({gr.roomTypeName})
                          </span>
                          {gr.isGroupMaster && (
                            <Badge
                              variant="outline"
                              className="text-[9px] uppercase px-1.5 py-0.2 bg-primary/15 text-primary border-primary/30 font-bold"
                            >
                              Master
                            </Badge>
                          )}
                          {isViewing && (
                            <span className="text-[10px] text-primary font-bold">
                              (Current)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                        {gr.reference}
                      </td>
                      <td className="py-2.5 px-3">
                        {getStatusBadge(gr.status)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground">
                        {formatINR(gr.rateApplied)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {nights}d
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        {formatINR(charge)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {!isViewing ? (
                          <Link
                            href={`/bookings/${gr.id}`}
                            className="text-xs text-primary hover:underline font-semibold"
                          >
                            Switch Room
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium">
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-border/80 font-bold text-xs bg-muted/30">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3">
                    Total ({booking.groupRooms.length} Rooms Combined)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-primary">
                    {formatINR(
                      booking.groupRooms.reduce((sum, r) => sum + r.rateApplied, 0)
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground font-normal">
                    —
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-primary font-bold">
                    {formatINR(
                      booking.groupBill?.roomCharges ??
                        booking.groupRooms.reduce(
                          (sum, r) =>
                            sum +
                            (r.roomCharge ??
                              r.rateApplied * (r.stayDays ?? booking.stayDays)),
                          0
                        )
                    )}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Main Grid: Details on Left (2/3), Bill Summary on Right (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Guests Card */}
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <GuestIcon className="size-4 text-primary" />
              Guest Information ({booking.guests.length})
            </h3>
            <div className="divide-y divide-border/60">
              {booking.guests.map((guest) => (
                <div
                  key={guest.id}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-sm">
                        {guest.name}
                      </span>
                      {guest.isPrimary && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-primary/10 text-primary border-primary/30"
                        >
                          Primary Guest
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5 space-x-2">
                      {guest.mobile && <span>Phone: {guest.mobile}</span>}
                      {guest.age && <span>Age: {guest.age}</span>}
                      {guest.sex && <span>Gender: {guest.sex}</span>}
                    </div>
                  </div>
                  {guest.fatherName && (
                    <span className="text-muted-foreground text-right">
                      S/D/W of: {guest.fatherName}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {booking.companyName && (
              <div className="pt-3 border-t border-border/80 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground block mb-1">
                  Corporate Details:
                </span>
                <div>
                  Company: <strong>{booking.companyName}</strong>
                </div>
                {booking.companyGstin && (
                  <div>
                    GSTIN: <strong>{booking.companyGstin}</strong>
                  </div>
                )}
                {booking.companyAddress && (
                  <div>Address: {booking.companyAddress}</div>
                )}
              </div>
            )}
          </Card>

          {/* Stay Timeline Card */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CalendarIcon className="size-4 text-primary" />
                Stay & Room Timeline
              </h3>
              {!isCheckedOut && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditDatesOpen(true)}
                  className="h-7 text-xs"
                >
                  <CalendarIcon className="size-3 mr-1" />
                  Edit Dates
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-muted/40 p-2.5 rounded-lg border border-border/60">
                <span className="text-muted-foreground block text-[11px]">
                  Room Number
                </span>
                <span className="font-bold text-foreground text-base font-mono">
                  {booking.roomNumber}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {booking.roomTypeName}
                </span>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-lg border border-border/60">
                <span className="text-muted-foreground block text-[11px]">
                  Billed Tariff
                </span>
                <span className="font-bold text-foreground text-base font-mono">
                  {formatINR(booking.rateApplied)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  per 24-hour day
                </span>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-lg border border-border/60">
                <span className="text-muted-foreground block text-[11px]">
                  Total Stay
                </span>
                <span className="font-bold text-foreground text-base font-mono">
                  {booking.stayDays} days
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  24-hour rule
                </span>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-lg border border-border/60">
                <span className="text-muted-foreground block text-[11px]">
                  Booking Source
                </span>
                <span className="font-bold text-foreground text-sm uppercase">
                  {booking.source}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Channel
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-mono">
              <div className="border border-border/60 p-2.5 rounded-lg">
                <span className="text-muted-foreground block text-[11px]">
                  Check-in Date & Time
                </span>
                <span className="font-semibold text-foreground">
                  {formatISTDateTime(
                    booking.actualCheckInAt || booking.checkInAt
                  )}
                </span>
              </div>
              <div className="border border-border/60 p-2.5 rounded-lg">
                <span className="text-muted-foreground block text-[11px]">
                  Check-out Date & Time
                </span>
                <span className="font-semibold text-foreground">
                  {formatISTDateTime(
                    booking.actualCheckOutAt || booking.checkOutAt
                  )}
                </span>
              </div>
            </div>
          </Card>

          {/* Charges Table */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <RupeeIcon className="size-4 text-primary" />
                Additional Charges & Services ({booking.charges.length})
              </h3>
              {!isCheckedOut && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChargeOpen(true)}
                  className="h-7 text-xs"
                >
                  <AddIcon className="size-3 mr-1" />
                  Add
                </Button>
              )}
            </div>

            {booking.charges.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 italic">
                No additional charges added to this stay yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="py-2">Description</th>
                      <th className="py-2">Taxable</th>
                      <th className="py-2 text-right">Amount</th>
                      {!isCheckedOut && (
                        <th className="py-2 text-right">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {booking.charges.map((charge) => (
                      <tr key={charge.id} className="hover:bg-muted/20">
                        <td className="py-2 font-medium text-foreground">
                          {charge.description}
                        </td>
                        <td className="py-2">
                          {charge.isTaxable ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300"
                            >
                              GST Taxable
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">
                              Non-taxable
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right font-mono font-semibold">
                          {formatINR(charge.amount)}
                        </td>
                        {!isCheckedOut && (
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteCharge(charge.id)}
                              disabled={deletingChargeId === charge.id}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Delete charge"
                            >
                              <DeleteIcon className="size-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Payments & Refunds Table */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <PaymentIcon className="size-4 text-primary" />
                Payments & Transactions ({booking.payments.length})
              </h3>
              {!isCheckedOut && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPaymentKind("PAYMENT");
                      setPaymentOpen(true);
                    }}
                    className="h-7 text-xs"
                  >
                    <AddIcon className="size-3 mr-1" />
                    Record Payment
                  </Button>
                </div>
              )}
            </div>

            {booking.payments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 italic">
                No payment transactions recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="py-2">Date</th>
                      <th className="py-2">Type</th>
                      <th className="py-2">Mode</th>
                      <th className="py-2">Note</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {booking.payments.map((pmt) => (
                      <tr key={pmt.id} className="hover:bg-muted/20">
                        <td className="py-2 font-mono text-muted-foreground">
                          {formatISTDateTime(pmt.receivedAt)}
                        </td>
                        <td className="py-2">
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
                        <td className="py-2 font-mono text-[11px] font-medium">
                          {pmt.mode}
                        </td>
                        <td className="py-2 text-muted-foreground text-[11px]">
                          {pmt.note || "—"}
                        </td>
                        <td
                          className={`py-2 text-right font-mono font-semibold ${
                            pmt.kind === "REFUND"
                              ? "text-red-600 dark:text-red-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {pmt.kind === "REFUND"
                            ? `-${formatINR(pmt.amount)}`
                            : formatINR(pmt.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Sticky Bill Summary & Invoice Card */}
        <div className="space-y-6">
          <Card className="p-5 space-y-3.5 sticky top-6">
            <div className="flex items-center justify-between border-b border-border/80 pb-2">
              <h3 className="text-sm font-semibold text-foreground">
                {isGroup ? "Group Stay Bill Summary" : "Stay Bill Summary"}
              </h3>
              {isGroup && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20"
                >
                  {booking.groupRooms?.length} Rooms
                </Badge>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>
                  {isGroup
                    ? `Total Room Charges (${booking.groupRooms?.length} rooms)`
                    : `Room Charges (${booking.stayDays}d × ${formatINRPlain(booking.rateApplied)})`}
                </span>
                <span className="font-mono font-medium text-foreground">
                  {formatINR(
                    isGroup
                      ? (booking.groupBill?.roomCharges ?? booking.roomCharges)
                      : booking.roomCharges
                  )}
                </span>
              </div>

              {(isGroup
                ? (booking.groupBill?.totalCharges ?? 0) > 0
                : booking.charges.length > 0) && (
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Additional Services</span>
                  <span className="font-mono font-medium text-foreground">
                    {formatINR(
                      isGroup
                        ? (booking.groupBill?.totalCharges ?? 0)
                        : booking.charges.reduce((acc, c) => acc + c.amount, 0)
                    )}
                  </span>
                </div>
              )}

              {(isGroup
                ? (booking.groupBill?.discount ?? 0) > 0
                : booking.discount > 0) && (
                <div className="flex justify-between items-center text-red-600 dark:text-red-400 font-medium">
                  <span>Discount</span>
                  <span className="font-mono">
                    -{formatINR(
                      isGroup
                        ? (booking.groupBill?.discount ?? 0)
                        : booking.discount
                    )}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-border/60 text-muted-foreground">
                <span>Taxable Amount</span>
                <span className="font-mono font-medium text-foreground">
                  {formatINR(
                    isGroup
                      ? (booking.groupBill?.taxableAmount ?? booking.taxableAmount)
                      : booking.taxableAmount
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center text-muted-foreground">
                <span>
                  GST ({isGroup ? (booking.groupBill?.gstPercent ?? booking.effectiveGstPercent) : booking.effectiveGstPercent}% — CGST/SGST split)
                </span>
                <span className="font-mono font-medium text-foreground">
                  {formatINR(
                    isGroup
                      ? (booking.groupBill?.totalGst ?? booking.taxAmount)
                      : booking.taxAmount
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2.5 border-t-2 border-border text-base font-bold text-foreground">
                <span>Total Bill</span>
                <span className="font-mono text-primary text-lg">
                  {formatINR(
                    isGroup
                      ? (booking.groupBill?.billAmount ?? booking.totalAmount)
                      : booking.totalAmount
                  )}
                </span>
              </div>

              <div className="pt-2 border-t border-border/60 space-y-1.5">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Net Payments Received</span>
                  <span className="font-mono text-emerald-600 font-semibold">
                    {formatINR(
                      isGroup
                        ? (booking.groupBill?.netPaid ?? booking.totalPaid)
                        : booking.totalPaid
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1 text-sm font-bold">
                  <span>Balance Due</span>
                  <span
                    className={`font-mono ${
                      (isGroup
                        ? (booking.groupBill?.balanceDue ?? booking.balanceDue)
                        : booking.balanceDue) > 0
                        ? "text-red-600 dark:text-red-400 text-base"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {formatINR(
                      isGroup
                        ? (booking.groupBill?.balanceDue ?? booking.balanceDue)
                        : booking.balanceDue
                    )}
                  </span>
                </div>
              </div>
            </div>

            {(isCheckedIn || (isGroup && booking.groupRooms?.some((r) => r.status === "CHECKED_IN"))) && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setCheckoutOpen(true)}
                className="w-full mt-2 font-semibold shadow-xs"
              >
                <CheckOutIcon className="size-4 mr-2" />
                {isGroup ? "Check Out Entire Group & Issue Invoice" : "Check Out & Generate Invoice"}
              </Button>
            )}

            {(isCheckedOut || (isGroup && booking.invoice)) && booking.invoice && (
              <div className="pt-3 border-t border-border/80 space-y-2">
                <div className="bg-muted/40 p-3 rounded-lg border border-border/60 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">
                      Tax Invoice
                    </span>
                    <Badge
                      variant="outline"
                      className="font-mono font-bold text-primary"
                    >
                      {booking.invoice.displayNo}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">
                      Issued At
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {formatISTDateTime(booking.invoice.issuedAt)}
                    </span>
                  </div>
                </div>

                <a
                  href={`/api/invoices/${booking.invoice.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "w-full text-xs font-semibold"
                  )}
                >
                  <PrintIcon className="size-3.5 mr-1.5" />
                  View / Print PDF
                </a>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modals */}
      <CheckoutDialog
        bookingId={
          isGroup
            ? (booking.groupRooms?.find((r) => r.isGroupMaster)?.id || booking.id)
            : booking.id
        }
        bookingRef={
          isGroup
            ? (booking.groupRooms?.find((r) => r.isGroupMaster)?.reference || booking.reference)
            : booking.reference
        }
        roomNumber={
          isGroup
            ? (booking.groupRooms?.map((r) => r.roomNumber).join(", ") || booking.roomNumber)
            : booking.roomNumber
        }
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        onSuccess={() => router.refresh()}
      />

      <AddChargeDialog
        bookingId={booking.id}
        bookingRef={booking.reference}
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        onSuccess={() => router.refresh()}
      />

      <AddPaymentDialog
        bookingId={booking.id}
        bookingRef={booking.reference}
        balanceDue={booking.balanceDue}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        defaultKind={paymentKind}
        onSuccess={() => router.refresh()}
      />

      <CheckInConfirmDialog
        open={checkInConfirmOpen}
        onOpenChange={setCheckInConfirmOpen}
        booking={{
          id: booking.id,
          reference: booking.reference,
          roomNumber: booking.roomNumber,
          roomTypeName: booking.roomTypeName,
          guestName: primaryGuestName,
          groupBookingId: booking.groupBookingId,
          groupRooms: booking.groupRooms?.map((gr) => ({
            id: gr.id,
            roomNumber: gr.roomNumber,
            roomTypeName: gr.roomTypeName,
            status: gr.status,
          })),
        }}
        onSuccess={() => router.refresh()}
      />

      <CancelBookingDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        booking={{
          id: booking.id,
          reference: booking.reference,
          roomNumber: booking.roomNumber,
          guestName: primaryGuestName,
          totalPaid: booking.totalPaid,
        }}
        onSuccess={() => router.refresh()}
      />

      <EditStayDatesDialog
        open={editDatesOpen}
        onOpenChange={setEditDatesOpen}
        bookingId={booking.id}
        bookingRef={booking.reference}
        roomNumber={booking.roomNumber}
        checkInAt={booking.actualCheckInAt || booking.checkInAt}
        checkOutAt={booking.checkOutAt}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
