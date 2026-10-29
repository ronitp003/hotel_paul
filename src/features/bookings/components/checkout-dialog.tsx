"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
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
} from "@/lib/icons";

export interface BookingBillData {
  booking: {
    id: string;
    reference: string;
    status: string;
    roomNumber: string;
    roomTypeName: string;
    primaryGuest?: { name: string };
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
}

interface CheckoutDialogProps {
  bookingId: string;
  bookingRef: string;
  roomNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: { invoiceId: string; displayNo: string }) => void;
}

export function CheckoutDialog({
  bookingId,
  bookingRef,
  roomNumber,
  open,
  onOpenChange,
  onSuccess,
}: CheckoutDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [billData, setBillData] = useState<BookingBillData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Settlement Form State
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "CARD" | "BANK_TRANSFER">("UPI");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [allowZeroPaymentWithBalance, setAllowZeroPaymentWithBalance] = useState(false);

  const isLoadingBill = open && !billData && !loadError;

  // Load live bill calculation when dialog opens
  const fetchBill = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await getBookingBillAction(bookingId);
      if (res.ok && res.data) {
        const data = res.data as BookingBillData;
        setBillData(data);
        if (data.bill.balanceDue > 0) {
          setPaymentAmount(data.bill.balanceDue.toString());
        } else {
          setPaymentAmount("0");
        }
      } else {
        setLoadError(res.message || "Failed to load stay bill calculation.");
        toast.error(res.message || "Failed to load stay bill calculation.");
      }
    } catch {
      setLoadError("Failed to fetch bill calculation.");
      toast.error("Failed to fetch bill calculation.");
    }
  }, [bookingId]);

  useEffect(() => {
    if (!open) return;
    let isCancelled = false;

    getBookingBillAction(bookingId)
      .then((res) => {
        if (isCancelled) return;
        if (res.ok && res.data) {
          const data = res.data as BookingBillData;
          setBillData(data);
          if (data.bill.balanceDue > 0) {
            setPaymentAmount(data.bill.balanceDue.toString());
          } else {
            setPaymentAmount("0");
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
  }, [open, bookingId]);

  const handleCheckout = () => {
    const amtNum = parseFloat(paymentAmount) || 0;

    startTransition(async () => {
      const res = await checkoutAction({
        bookingId,
        paymentAmount: amtNum > 0 ? amtNum : undefined,
        paymentMode: amtNum > 0 ? paymentMode : undefined,
        paymentNote: amtNum > 0 ? paymentNote : undefined,
        allowZeroPaymentWithBalance,
      });

      if (!res.ok) {
        toast.error(res.message || "Checkout failed.");
        return;
      }

      const result = res.data as { invoiceId: string; displayNo: string };
      toast.success(
        `Stay checked out! Tax Invoice ${result.displayNo} generated.`,
        {
          action: {
            label: "View PDF",
            onClick: () => window.open(`/api/invoices/${result.invoiceId}/pdf`, "_blank"),
          },
          duration: 8000,
        }
      );

      onOpenChange(false);
      onSuccess?.(result);
    });
  };

  const currentBalance = billData ? billData.bill.balanceDue : 0;
  const payAmt = parseFloat(paymentAmount) || 0;
  const netRemainingAfterPayment = Math.max(0, currentBalance - payAmt);

  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      setBillData(null);
      setLoadError(null);
      setPaymentAmount("");
      setPaymentNote("");
      setAllowZeroPaymentWithBalance(false);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg text-foreground">
            <CheckOutIcon className="size-5 text-primary" />
            Check-out & Issue Invoice — Room {roomNumber}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Review final stay charges, settle any pending balance, and generate an immutable gapless GST Tax Invoice for booking{" "}
            <span className="font-mono font-semibold text-foreground">{bookingRef}</span>.
          </DialogDescription>
        </DialogHeader>

        {isLoadingBill ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <SpinnerIcon className="size-6 animate-spin text-primary" />
            <span className="text-xs">Computing 24-hour stay and GST calculations...</span>
          </div>
        ) : billData ? (
          <div className="space-y-4 py-2 text-xs">
            {/* Stay & Room Summary Box */}
            <div className="bg-muted/40 p-3 rounded-lg border border-border/80 flex items-center justify-between">
              <div>
                <span className="text-muted-foreground block text-[11px]">Primary Guest</span>
                <span className="font-semibold text-foreground text-sm">
                  {billData.booking.primaryGuest?.name || "Guest"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground block text-[11px]">Billed Duration</span>
                <span className="font-semibold text-foreground font-mono">
                  {billData.stay.days} {billData.stay.days === 1 ? "day" : "days"} ({billData.stay.hours}h)
                </span>
              </div>
            </div>

            {/* Bill Breakdown Card */}
            <div className="border border-border rounded-lg p-3.5 bg-card space-y-2">
              <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground border-b border-border/60 pb-1.5">
                Stay Bill Breakdown
              </h4>

              <div className="flex justify-between items-center py-0.5">
                <span className="text-muted-foreground">
                  Room Tariff ({formatINRPlain(billData.bill.rateApplied)} × {billData.stay.days} days)
                </span>
                <span className="font-mono font-medium">{formatINR(billData.bill.roomCharges)}</span>
              </div>

              {billData.charges.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-dashed border-border">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Additional Services / Charges:
                  </span>
                  {billData.charges.map((c) => (
                    <div key={c.id} className="flex justify-between items-center text-[11px] pl-2 text-muted-foreground">
                      <span>• {c.description} {c.isTaxable ? "(Taxable)" : ""}</span>
                      <span className="font-mono">{formatINR(c.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {billData.bill.discount > 0 && (
                <div className="flex justify-between items-center text-red-600 dark:text-red-400 py-0.5 font-medium">
                  <span>Discount</span>
                  <span className="font-mono">-{formatINR(billData.bill.discount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-1.5 border-t border-border">
                <span className="text-muted-foreground">Taxable Value</span>
                <span className="font-mono font-medium">{formatINR(billData.bill.taxableAmount)}</span>
              </div>

              <div className="flex justify-between items-center py-0.5 text-muted-foreground">
                <span>
                  GST ({billData.bill.gstPercent}% — CGST {billData.bill.gstPercent / 2}%, SGST{" "}
                  {billData.bill.gstPercent / 2}%)
                </span>
                <span className="font-mono font-medium">{formatINR(billData.bill.totalGst)}</span>
              </div>

              {billData.bill.roundOff !== 0 && (
                <div className="flex justify-between items-center py-0.5 text-muted-foreground">
                  <span>Round-off</span>
                  <span className="font-mono">{formatINR(billData.bill.roundOff)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t-2 border-primary/20 text-sm font-bold text-foreground">
                <span>Total Bill Amount</span>
                <span className="font-mono text-primary text-base">{formatINR(billData.bill.billAmount)}</span>
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
                    <Label htmlFor="checkout-payment-amount" className="text-xs">
                      Payment Amount (₹)
                    </Label>
                    <Input
                      id="checkout-payment-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="h-8 text-xs font-mono mt-1 bg-background"
                      placeholder="Enter amount..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="checkout-payment-mode" className="text-xs">
                      Payment Mode
                    </Label>
                    <select
                      id="checkout-payment-mode"
                      value={paymentMode}
                      onChange={(e) =>
                        setPaymentMode(
                          e.target.value as
                            | "CASH"
                            | "UPI"
                            | "CARD"
                            | "BANK_TRANSFER"
                        )
                      }
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1 font-medium"
                    >
                      <option value="UPI">UPI / QR Code</option>
                      <option value="CASH">Cash</option>
                      <option value="CARD">Credit / Debit Card</option>
                      <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                    </select>
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
                      onChange={(e) => setAllowZeroPaymentWithBalance(e.target.checked)}
                      className="size-4 rounded border-border text-primary cursor-pointer"
                    />
                    <label htmlFor="allow-unsettled-balance" className="text-[11px] text-muted-foreground cursor-pointer">
                      Confirm check-out with pending balance (₹{formatINRPlain(netRemainingAfterPayment)})
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Fully Settled Banner */}
            {currentBalance <= 0 && (
              <div className="border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-lg flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-xs">
                <CheckIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium">Stay is fully settled (₹0.00 balance due). Ready to issue Tax Invoice.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground space-y-2">
            <ProblemIcon className="size-7 mx-auto text-amber-500" />
            <p>Could not load stay bill calculations for this booking.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchBill}
              className="text-xs font-medium"
            >
              Retry Calculation
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleCheckout}
            disabled={
              isPending ||
              isLoadingBill ||
              !billData ||
              (currentBalance > 0 && payAmt < currentBalance && !allowZeroPaymentWithBalance)
            }
            className="font-semibold"
          >
            {isPending ? (
              <>
                <SpinnerIcon className="size-4 animate-spin mr-1.5" />
                Processing Check-out...
              </>
            ) : (
              <>
                <CheckIcon className="size-4 mr-1.5" />
                Confirm Check-Out & Issue Invoice
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
