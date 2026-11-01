import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CheckoutDialog } from "@/features/bookings/components/checkout-dialog";
import * as billingActions from "@/server/actions/billing.actions";
import * as invoiceActions from "@/server/actions/invoice.actions";

// Mock the server actions
vi.mock("@/server/actions/billing.actions", () => ({
  getBookingBillAction: vi.fn(),
}));

vi.mock("@/server/actions/invoice.actions", () => ({
  checkoutAction: vi.fn(),
}));

describe("Checkout Loading Feedback & State", () => {
  const mockBillData = {
    booking: {
      id: "booking-123",
      reference: "BK-20261101-001",
      status: "CHECKED_IN",
      roomNumber: "101",
      roomTypeName: "Deluxe",
      primaryGuest: { name: "John Doe" },
    },
    stay: {
      days: 1,
      hours: 2,
      minutes: 10,
      graceMinutesApplied: false,
    },
    charges: [],
    payments: [],
    bill: {
      rateApplied: 2500,
      days: 1,
      roomCharges: 2500,
      taxableChargesTotal: 0,
      nonTaxableChargesTotal: 0,
      totalCharges: 2500,
      discount: 0,
      taxableAmount: 2500,
      gstPercent: 12,
      cgst: 150,
      sgst: 150,
      totalGst: 300,
      subtotalWithTax: 2800,
      roundOff: 0,
      billAmount: 2800,
      advancePaid: 2800,
      subsequentPaid: 0,
      totalPaid: 2800,
      refundsTotal: 0,
      netPaid: 2800,
      balanceDue: 0,
    },
  };

  it("shows 'Processing Checkout...' with loading spinner and disabled state during checkout execution", async () => {
    vi.mocked(billingActions.getBookingBillAction).mockResolvedValue({
      ok: true,
      data: mockBillData,
    });

    // Make checkoutAction take some time to resolve so we can inspect loading state
    type CheckoutActionResult = Awaited<
      ReturnType<typeof invoiceActions.checkoutAction>
    >;
    let resolveCheckout!: (val: CheckoutActionResult) => void;
    const checkoutPromise = new Promise<CheckoutActionResult>((resolve) => {
      resolveCheckout = resolve;
    });
    vi.mocked(invoiceActions.checkoutAction).mockReturnValue(checkoutPromise);

    const onProcessingChange = vi.fn();
    const onSuccess = vi.fn();

    render(
      <CheckoutDialog
        bookingId="booking-123"
        bookingRef="BK-20261101-001"
        roomNumber="101"
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={onSuccess}
        onProcessingChange={onProcessingChange}
      />
    );

    // Wait for bill calculation to load
    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /confirm check-out & issue invoice/i,
        })
      ).toBeDefined();
    });

    const checkoutBtn = screen.getByRole("button", {
      name: /confirm check-out & issue invoice/i,
    });

    // Click checkout
    fireEvent.click(checkoutBtn);

    // Verify onProcessingChange(true) was called immediately
    expect(onProcessingChange).toHaveBeenCalledWith(true);

    // Verify button text changed to 'Processing Checkout...' and is disabled
    await waitFor(() => {
      expect(screen.getByText("Processing Checkout...")).toBeDefined();
    });

    const busyBtn = screen.getByRole("button", {
      name: /processing checkout\.\.\./i,
    });
    expect(busyBtn).toBeDefined();
    expect(busyBtn.hasAttribute("disabled")).toBe(true);
    expect(busyBtn.className).toContain("min-w-[210px]");

    // Resolve checkout successfully
    resolveCheckout({
      ok: true,
      data: {
        success: true,
        invoiceId: "inv-999",
        displayNo: "INV-202611-001",
        billAmount: 1200,
        balanceDue: 0,
        bookingId: "booking-123",
      },
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: "inv-999",
          displayNo: "INV-202611-001",
        })
      );
    });
  });

  it("handles checkout failure gracefully, stopping spinner, re-enabling button, and allowing retry", async () => {
    vi.mocked(billingActions.getBookingBillAction).mockResolvedValue({
      ok: true,
      data: mockBillData,
    });

    vi.mocked(invoiceActions.checkoutAction).mockResolvedValue({
      ok: false,
      message: "Gateway timeout. Please retry.",
    });

    const onProcessingChange = vi.fn();

    render(
      <CheckoutDialog
        bookingId="booking-123"
        bookingRef="BK-20261101-001"
        roomNumber="101"
        open={true}
        onOpenChange={vi.fn()}
        onProcessingChange={onProcessingChange}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /confirm check-out & issue invoice/i,
        })
      ).toBeDefined();
    });

    const checkoutBtn = screen.getByRole("button", {
      name: /confirm check-out & issue invoice/i,
    });
    fireEvent.click(checkoutBtn);

    // On failure, button should be re-enabled and restored
    await waitFor(() => {
      expect(onProcessingChange).toHaveBeenCalledWith(false);
      const restoredBtn = screen.getByRole("button", {
        name: /confirm check-out & issue invoice/i,
      });
      expect(restoredBtn).toBeDefined();
      expect(restoredBtn.hasAttribute("disabled")).toBe(false);
    });
  });
});
