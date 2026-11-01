"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { formatINR, formatINRPlain } from "@/lib/money";
import { getBookingBillAction } from "@/server/actions/billing.actions";
import { checkoutAction } from "@/server/actions/invoice.actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckOutIcon,
  SpinnerIcon,
  CheckIcon,
  ProblemIcon,
  CalendarIcon,
  InvoiceIcon,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { SelectDropdown } from "@/components/ui/select-dropdown";

export interface BookingBillData {
  booking: {
    id: string;
    reference: string;
    status: string;
    roomNumber: string;
    roomTypeName: string;
    primaryGuest?: { name: string };
    companyName?: string | null;
    companyGstin?: string | null;
    companyAddress?: string | null;
  };
  stay: {
    days: number;
    hours: number;
    minutes: number;
    graceMinutesApplied: boolean;
  };
  charges: Array<{
    id: string;
    description: string;
    amount: number;
    isTaxable: boolean;
  }>;
  payments: Array<{
    id: string;
    kind: string;
    mode: string;
    amount: number;
  }>;
  bill: {
    rateApplied: number;
    days: number;
    roomCharges: number;
    taxableChargesTotal: number;
    nonTaxableChargesTotal: number;
    totalCharges: number;
    discount: number;
    taxableAmount: number;
    gstPercent: number;
    cgst: number;
    sgst: number;
    totalGst: number;
    subtotalWithTax: number;
    roundOff: number;
    billAmount: number;
    advancePaid: number;
    subsequentPaid: number;
    totalPaid: number;
    refundsTotal: number;
    netPaid: number;
    balanceDue: number;
  };
  isGroup?: boolean;
  groupRooms?: Array<{
    bookingId: string;
    reference: string;
    roomId: string;
    roomNumber: string;
    roomTypeName: string;
    stayDays: number;
    rateApplied: number;
    roomCharge: number;
    status: string;
    isGroupMaster: boolean;
    guests: Array<{
      id: string;
      name: string;
      mobile: string | null;
      isPrimary: boolean;
      allocatedRoomId?: string | null;
    }>;
  }>;
}

interface CheckoutDialogProps {
  bookingId: string;
  bookingRef: string;
  roomNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: { invoiceId: string; displayNo: string }) => void;
  onProcessingChange?: (isProcessing: boolean) => void;
}

export function CheckoutDialog({
  bookingId,
  bookingRef,
  roomNumber,
  open,
  onOpenChange,
  onSuccess,
  onProcessingChange,
}: CheckoutDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCheckoutBusy = isPending || isSubmitting;
  const [billData, setBillData] = useState<BookingBillData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Settlement Form State
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<
    "CASH" | "UPI" | "CARD" | "BANK_TRANSFER"
  >("UPI");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [allowZeroPaymentWithBalance, setAllowZeroPaymentWithBalance] =
    useState(false);

  // Early Departure State
  const [isEarlyCheckout, setIsEarlyCheckout] = useState(false);
  const [refundMode, setRefundMode] = useState<
    "CASH" | "UPI" | "CARD" | "BANK_TRANSFER"
  >("CASH");
  const [refundNote, setRefundNote] = useState<string>("Early check-out refund");

  // Corporate Billing State
  const [showCorporate, setShowCorporate] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [gstinError, setGstinError] = useState<string | null>(null);

  const isLoadingBill = open && !billData && !loadError;

  // Load live bill calculation when dialog opens or when isEarlyCheckout toggles
  useEffect(() => {
    if (!open) return;
    let isCancelled = false;

    getBookingBillAction(bookingId, { isEarlyCheckout })
      .then((res) => {
        if (isCancelled) return;
        if (res.ok && res.data) {
          const data = res.data as BookingBillData;
          setBillData(data);
          setLoadError(null);
          if (data.bill.balanceDue > 0) {
            setPaymentAmount(data.bill.balanceDue.toString());
          } else {
            setPaymentAmount("0");
          }
          if (data.booking.companyName || data.booking.companyGstin) {
            setShowCorporate(true);
            setCompanyName(data.booking.companyName || "");
            setCompanyGstin(data.booking.companyGstin || "");
            setCompanyAddress(data.booking.companyAddress || "");
          }
        } else {
          setLoadError(res.message || "Failed to load stay bill calculation.");
        }
      })
      .catch(() => {
        if (!isCancelled) setLoadError("Failed to fetch bill calculation.");
      });

    return () => {
      isCancelled = true;
    };
  }, [open, bookingId, isEarlyCheckout]);

  const handleRetry = () => {
    setLoadError(null);
    getBookingBillAction(bookingId, { isEarlyCheckout })
      .then((res) => {
        if (res.ok && res.data) {
          const data = res.data as BookingBillData;
          setBillData(data);
          if (data.bill.balanceDue > 0) {
            setPaymentAmount(data.bill.balanceDue.toString());
          } else {
            setPaymentAmount("0");
          }
          if (data.booking.companyName || data.booking.companyGstin) {
            setShowCorporate(true);
            setCompanyName(data.booking.companyName || "");
            setCompanyGstin(data.booking.companyGstin || "");
            setCompanyAddress(data.booking.companyAddress || "");
          }
        } else {
          setLoadError(res.message || "Failed to load stay bill calculation.");
        }
      })
      .catch(() => {
        setLoadError("Failed to fetch bill calculation.");
      });
  };

  const currentBalance = billData ? billData.bill.balanceDue : 0;
  const payAmt = parseFloat(paymentAmount) || 0;
  const netRemainingAfterPayment = Math.max(0, currentBalance - payAmt);

  const handleCheckout = () => {
    if (isCheckoutBusy) return;

    const amtNum = parseFloat(paymentAmount) || 0;
    const excessRefund = currentBalance < 0 ? Math.abs(currentBalance) : 0;

    if (currentBalance > 0 && amtNum > currentBalance) {
      toast.error(
        `Payment amount cannot exceed remaining balance due of ${formatINR(currentBalance)}.`
      );
      return;
    }

    if (showCorporate && companyGstin.trim()) {
      const gstinRegex =
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(companyGstin.trim())) {
        setGstinError(
          "Please enter a valid 15-character GSTIN (e.g. 27AAPFU0939F1ZV)"
        );
        toast.error("Please enter a valid 15-character GSTIN for corporate billing.");
        return;
      }
    }

    setIsSubmitting(true);
    onProcessingChange?.(true);

    startTransition(async () => {
      try {
        const res = await checkoutAction({
          bookingId,
          paymentAmount: amtNum > 0 ? amtNum : undefined,
          paymentMode: amtNum > 0 ? paymentMode : undefined,
          paymentNote: amtNum > 0 ? paymentNote : undefined,
          allowZeroPaymentWithBalance,
          isEarlyCheckout,
          refundAmount: excessRefund > 0 ? excessRefund : undefined,
          refundMode: excessRefund > 0 ? refundMode : undefined,
          refundNote: excessRefund > 0 ? refundNote : undefined,
          companyName:
            showCorporate && companyName.trim() ? companyName.trim() : undefined,
          companyGstin:
            showCorporate && companyGstin.trim()
              ? companyGstin.trim().toUpperCase()
              : undefined,
          companyAddress:
            showCorporate && companyAddress.trim()
              ? companyAddress.trim()
              : undefined,
        });

        if (!res.ok) {
          setIsSubmitting(false);
          onProcessingChange?.(false);
          toast.error(res.message || "Checkout failed. Please try again.");
          return;
        }

        const result = res.data as { invoiceId: string; displayNo: string };
        toast.success(
          `Stay checked out! Tax Invoice ${result.displayNo} generated.`,
          {
            action: {
              label: "View PDF",
              onClick: () =>
                window.open(`/api/invoices/${result.invoiceId}/pdf`, "_blank"),
            },
            duration: 8000,
          }
        );

        setIsSubmitting(false);
        onOpenChange(false);
        onSuccess?.(result);
      } catch (err) {
        console.error("Checkout execution error:", err);
        setIsSubmitting(false);
        onProcessingChange?.(false);
        toast.error("Checkout failed unexpectedly. Please retry.");
      }
    });
  };

  const handleDialogChange = (isOpen: boolean) => {
    // Prevent dismissing dialog while checkout mutation is processing
    if (isCheckoutBusy) return;

    if (!isOpen) {
      setBillData(null);
      setLoadError(null);
      setPaymentAmount("");
      setPaymentNote("");
      setAllowZeroPaymentWithBalance(false);
      setIsEarlyCheckout(false);
      setRefundMode("CASH");
      setRefundNote("Early check-out refund");
      setShowCorporate(false);
      setCompanyName("");
      setCompanyGstin("");
      setCompanyAddress("");
      setGstinError(null);
      onProcessingChange?.(false);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl flex flex-col p-0 gap-0 max-h-[calc(100dvh-2rem)] sm:max-h-[88vh] overflow-hidden">
        <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-3.5 border-b border-border/80 shrink-0 pr-12">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg text-foreground font-semibold">
            <CheckOutIcon className="size-5 text-primary shrink-0" />
            <span className="truncate">
              Check-out & Issue Invoice — {billData?.isGroup ? `Group of ${billData.groupRooms?.length} Rooms` : `Room ${roomNumber}`}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-0.5">
            Review final stay charges, settle any pending balance, and generate
            an immutable gapless GST Tax Invoice for booking{" "}
            <span className="font-mono font-semibold text-foreground">
              {bookingRef}
            </span>
            {billData?.isGroup && " (Combined Group Reservation)"}.
          </DialogDescription>
        </DialogHeader>

        {isLoadingBill ? (
          <div className="flex-1 min-h-[240px] flex flex-col items-center justify-center gap-2.5 p-6 text-muted-foreground">
            <SpinnerIcon className="size-6 animate-spin text-primary" />
            <span className="text-xs font-medium">
              Computing 24-hour stay and GST calculations...
            </span>
          </div>
        ) : billData ? (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4 text-xs custom-scrollbar">
            {/* Early Departure Switch */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-muted/40 gap-3">
              <div className="space-y-0.5 pr-2 min-w-0">
                <label
                  htmlFor="early-checkout-toggle"
                  className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5"
                >
                  <CalendarIcon className="size-3.5 text-primary shrink-0" />
                  <span>Early Departure / Bill Only Up to Today</span>
                </label>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Guest leaving early? Recalculate stay tariff for duration up to now instead of full scheduled booking.
                </p>
              </div>
              <input
                id="early-checkout-toggle"
                type="checkbox"
                checked={isEarlyCheckout}
                onChange={(e) => setIsEarlyCheckout(e.target.checked)}
                className="size-4 shrink-0 rounded border-border text-primary cursor-pointer accent-primary"
              />
            </div>

            {/* Stay & Room Summary Box */}
            <div className="bg-muted/40 p-3 rounded-lg border border-border/80 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-muted-foreground block text-[11px]">
                  Primary Guest
                </span>
                <span className="font-semibold text-foreground text-sm truncate block">
                  {billData.booking.primaryGuest?.name || "Guest"}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-muted-foreground block text-[11px]">
                  Billed Duration
                </span>
                <span className="font-semibold text-foreground font-mono">
                  {billData.stay.days}{" "}
                  {billData.stay.days === 1 ? "day" : "days"} (
                  {billData.stay.hours}h)
                </span>
              </div>
            </div>

            {/* Group Rooms Breakdown (if multi-room booking) */}
            {billData.isGroup && billData.groupRooms && billData.groupRooms.length > 1 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-primary">
                  <span>Group Rooms ({billData.groupRooms.length} Rooms)</span>
                  <span className="text-[11px] font-normal text-muted-foreground">Combined billing</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {billData.groupRooms.map((gr) => (
                    <div
                      key={gr.bookingId}
                      className="flex items-center justify-between p-2 rounded bg-background/80 border border-border/60"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>Room {gr.roomNumber}</span>
                          {gr.isGroupMaster && (
                            <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-primary/10 text-primary font-bold">
                              Master
                            </span>
                          )}
                        </div>
                        <span className="text-muted-foreground text-[11px] block truncate">
                          {gr.roomTypeName}
                        </span>
                        {gr.guests && gr.guests.length > 0 && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {gr.guests.map((g) => g.name).join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-medium text-foreground block">
                          ₹{formatINRPlain(gr.roomCharge)}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          ₹{formatINRPlain(gr.rateApplied)}/d
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Corporate / GSTIN Billing Details */}
            <div className="border border-border/70 rounded-lg p-3 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <InvoiceIcon className="size-3.5 text-primary shrink-0" />
                  <span>Corporate / GSTIN Billing Details</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowCorporate(!showCorporate)}
                  className="text-xs font-medium text-primary hover:underline cursor-pointer shrink-0"
                >
                  {showCorporate
                    ? "− Hide Details"
                    : companyName || companyGstin
                      ? "Edit Corporate Details"
                      : "+ Add Corporate / GSTIN"}
                </button>
              </div>

              {showCorporate ? (
                <div className="pt-2 border-t border-border/60 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <Label
                        htmlFor="checkout-company-name"
                        className="text-[11px] font-medium"
                      >
                        Company Name
                      </Label>
                      <Input
                        id="checkout-company-name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. ABC Technologies Pvt Ltd"
                        className="h-8 text-xs mt-1 bg-background"
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="checkout-company-gstin"
                        className="text-[11px] font-medium"
                      >
                        Company GSTIN (15 characters)
                      </Label>
                      <Input
                        id="checkout-company-gstin"
                        value={companyGstin}
                        onChange={(e) => {
                          setCompanyGstin(e.target.value.toUpperCase());
                          setGstinError(null);
                        }}
                        placeholder="e.g. 27AAPFU0939F1ZV"
                        className={cn(
                          "h-8 text-xs font-mono uppercase mt-1 bg-background",
                          gstinError &&
                            "border-destructive focus-visible:ring-destructive"
                        )}
                        maxLength={15}
                      />
                      {gstinError && (
                        <p className="text-[10px] text-destructive font-medium mt-0.5">
                          {gstinError}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label
                      htmlFor="checkout-company-address"
                      className="text-[11px] font-medium"
                    >
                      Company Address
                    </Label>
                    <Input
                      id="checkout-company-address"
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      placeholder="e.g. 42 MG Road, Sector 5, Bangalore"
                      className="h-8 text-xs mt-1 bg-background"
                    />
                  </div>
                </div>
              ) : companyName || companyGstin ? (
                <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  Billed to:{" "}
                  <strong className="text-foreground">
                    {companyName || "Corporate Client"}
                  </strong>
                  {companyGstin && (
                    <span>
                      {" "}
                      (GSTIN:{" "}
                      <span className="font-mono text-foreground font-semibold">
                        {companyGstin}
                      </span>
                      )
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Need a B2B Tax Invoice with company GSTIN? Click{" "}
                  <button
                    type="button"
                    onClick={() => setShowCorporate(true)}
                    className="text-primary hover:underline font-medium cursor-pointer"
                  >
                    + Add Corporate / GSTIN
                  </button>{" "}
                  to attach business tax credentials.
                </p>
              )}
            </div>

            {/* Bill Breakdown Card */}
            <div className="border border-border rounded-lg p-3.5 bg-card space-y-2">
              <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground border-b border-border/60 pb-1.5">
                Stay Bill Breakdown
              </h4>

              <div className="flex justify-between items-center py-0.5">
                <span className="text-muted-foreground">
                  {billData.isGroup &&
                  billData.groupRooms &&
                  billData.groupRooms.length > 1
                    ? `Combined Accommodation (${billData.groupRooms.length} rooms × ${billData.stay.days} days)`
                    : `Room Tariff (${formatINRPlain(billData.bill.rateApplied)} × ${billData.stay.days} days)`}
                </span>
                <span className="font-mono font-medium">
                  {formatINR(billData.bill.roomCharges)}
                </span>
              </div>

              {billData.charges.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-dashed border-border">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Additional Services / Charges:
                  </span>
                  {billData.charges.map((c) => (
                    <div
                      key={c.id}
                      className="flex justify-between items-center text-[11px] pl-2 text-muted-foreground"
                    >
                      <span>
                        • {c.description} {c.isTaxable ? "(Taxable)" : ""}
                      </span>
                      <span className="font-mono">{formatINR(c.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {billData.bill.discount > 0 && (
                <div className="flex justify-between items-center text-red-600 dark:text-red-400 py-0.5 font-medium">
                  <span>Discount</span>
                  <span className="font-mono">
                    -{formatINR(billData.bill.discount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-1.5 border-t border-border">
                <span className="text-muted-foreground">Taxable Value</span>
                <span className="font-mono font-medium">
                  {formatINR(billData.bill.taxableAmount)}
                </span>
              </div>

              <div className="flex justify-between items-center py-0.5 text-muted-foreground">
                <span>
                  GST ({billData.bill.gstPercent}% — CGST{" "}
                  {billData.bill.gstPercent / 2}%, SGST{" "}
                  {billData.bill.gstPercent / 2}%)
                </span>
                <span className="font-mono font-medium">
                  {formatINR(billData.bill.totalGst)}
                </span>
              </div>

              {billData.bill.roundOff !== 0 && (
                <div className="flex justify-between items-center py-0.5 text-muted-foreground">
                  <span>Round-off</span>
                  <span className="font-mono">
                    {formatINR(billData.bill.roundOff)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t-2 border-primary/20 text-sm font-bold text-foreground">
                <span>Total Bill Amount</span>
                <span className="font-mono text-primary text-base">
                  {formatINR(billData.bill.billAmount)}
                </span>
              </div>

              {/* Payments & Balance */}
              <div className="pt-2 border-t border-border space-y-1">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Total Payments Received (Advance + Stay)</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {formatINR(billData.bill.netPaid)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold pt-1">
                  <span>Current Balance Due</span>
                  <span
                    className={`font-mono text-sm ${
                      currentBalance > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {formatINR(currentBalance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Final Settlement Form */}
            {currentBalance > 0 && (
              <div className="border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-semibold text-xs">
                  <ProblemIcon className="size-4 shrink-0" />
                  Settle Pending Balance on Check-Out
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="checkout-payment-amount"
                        className="text-xs"
                      >
                        Payment Amount (₹)
                      </Label>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        Max:{" "}
                        <strong className="text-foreground">
                          {formatINR(currentBalance)}
                        </strong>
                      </span>
                    </div>
                    <Input
                      id="checkout-payment-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      max={currentBalance}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className={cn(
                        "h-8 text-xs font-mono mt-1 bg-background",
                        payAmt > currentBalance &&
                          "border-destructive focus-visible:ring-destructive"
                      )}
                      placeholder="Enter amount..."
                    />
                    {payAmt > currentBalance && (
                      <p className="text-[11px] text-destructive font-medium mt-1">
                        Amount cannot exceed balance due of {formatINR(currentBalance)}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="checkout-payment-mode" className="text-xs">
                      Payment Mode
                    </Label>
                    <SelectDropdown
                      id="checkout-payment-mode"
                      value={paymentMode}
                      onChange={(val) =>
                        setPaymentMode(
                          val as
                            | "CASH"
                            | "UPI"
                            | "CARD"
                            | "BANK_TRANSFER"
                        )
                      }
                      options={[
                        { value: "UPI", label: "UPI / QR Code" },
                        { value: "CASH", label: "Cash" },
                        { value: "CARD", label: "Credit / Debit Card" },
                        {
                          value: "BANK_TRANSFER",
                          label: "Bank Transfer / NEFT",
                        },
                      ]}
                      size="sm"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="checkout-payment-note" className="text-xs">
                    Payment Note (Optional)
                  </Label>
                  <Input
                    id="checkout-payment-note"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="e.g. Paid via GPay / Final settlement"
                    className="h-8 text-xs mt-1 bg-background"
                  />
                </div>

                {payAmt < currentBalance && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="allow-unsettled-balance"
                      checked={allowZeroPaymentWithBalance}
                      onChange={(e) =>
                        setAllowZeroPaymentWithBalance(e.target.checked)
                      }
                      className="size-4 rounded border-border text-primary cursor-pointer"
                    />
                    <label
                      htmlFor="allow-unsettled-balance"
                      className="text-[11px] text-muted-foreground cursor-pointer"
                    >
                      Confirm check-out with pending balance (₹
                      {formatINRPlain(netRemainingAfterPayment)})
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Excess Paid / Refund Due to Guest */}
            {currentBalance < 0 && (
              <div className="border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-3.5 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-semibold text-xs">
                  <CheckIcon className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  Excess Payment Collected — Refund Due to Guest: {formatINR(Math.abs(currentBalance))}
                </div>
                <p className="text-[11px] text-blue-800 dark:text-blue-300">
                  Because of the shortened stay, payments collected ({formatINR(billData.bill.netPaid)}) exceed the revised bill ({formatINR(billData.bill.billAmount)}). Confirming checkout will record this refund and settle the invoice at ₹0.00.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="checkout-refund-mode" className="text-xs">
                      Refund Mode
                    </Label>
                    <SelectDropdown
                      id="checkout-refund-mode"
                      value={refundMode}
                      onChange={(val) =>
                        setRefundMode(
                          val as
                            | "CASH"
                            | "UPI"
                            | "CARD"
                            | "BANK_TRANSFER"
                        )
                      }
                      options={[
                        { value: "CASH", label: "Cash Return" },
                        { value: "UPI", label: "UPI Refund" },
                        { value: "BANK_TRANSFER", label: "Bank Transfer" },
                        { value: "CARD", label: "Card Reversal" },
                      ]}
                      size="sm"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="checkout-refund-note" className="text-xs">
                      Refund Note
                    </Label>
                    <Input
                      id="checkout-refund-note"
                      value={refundNote}
                      onChange={(e) => setRefundNote(e.target.value)}
                      placeholder="e.g. Returned excess cash at front desk"
                      className="h-8 text-xs mt-1 bg-background"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Fully Settled Banner */}
            {currentBalance === 0 && (
              <div className="border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-lg flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-xs">
                <CheckIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium">
                  Stay is fully settled (₹0.00 balance due). Ready to issue Tax
                  Invoice.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-[240px] flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground space-y-3">
            <ProblemIcon className="size-7 mx-auto text-amber-500" />
            <p>Could not load stay bill calculations for this booking.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="text-xs font-medium cursor-pointer"
            >
              Retry Calculation
            </Button>
          </div>
        )}

        <DialogFooter className="m-0 border-t border-border/80 bg-muted/40 p-3.5 sm:p-4 px-4 sm:px-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 shrink-0 rounded-b-xl">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCheckoutBusy}
            className="h-9 px-4 text-xs sm:text-sm font-medium w-full sm:w-auto cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleCheckout}
            disabled={
              isCheckoutBusy ||
              isLoadingBill ||
              !billData ||
              (currentBalance > 0 && payAmt > currentBalance) ||
              (currentBalance > 0 &&
                payAmt < currentBalance &&
                !allowZeroPaymentWithBalance)
            }
            className="h-9 px-4 sm:px-5 text-xs sm:text-sm font-semibold w-full sm:w-auto shadow-xs cursor-pointer inline-flex items-center justify-center gap-1.5 min-w-[210px]"
          >
            {isCheckoutBusy ? (
              <>
                <SpinnerIcon className="size-4 animate-spin shrink-0" />
                <span>Processing Checkout...</span>
              </>
            ) : currentBalance < 0 ? (
              <>
                <CheckIcon className="size-4 shrink-0" />
                <span>
                  Confirm Check-Out & Refund {formatINR(Math.abs(currentBalance))}
                </span>
              </>
            ) : (
              <>
                <CheckIcon className="size-4 shrink-0" />
                <span>Confirm Check-Out & Issue Invoice</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
