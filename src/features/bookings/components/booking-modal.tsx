"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  formatIST,
  fromISTInput,
} from "@/lib/datetime";
import { formatINR } from "@/lib/money";
import { calculateStay, type StayCalculationResult } from "@/lib/stay";
import { createBookingAction } from "@/server/actions/booking.actions";
import { findAvailableRoomsAction } from "@/server/actions/room.actions";
import { listRoomTypesAction } from "@/server/actions/room-type.actions";
import { getBookingSettingsAction } from "@/server/actions/settings.actions";
import type { AvailableRoomResult } from "@/server/services/room.service";
import {
  CalendarIcon,
  CheckInIcon,
  RoomIcon,
  GuestIcon,
  RupeeIcon,
  AddIcon,
  DeleteIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  CheckIcon,
  SpinnerIcon,
  BuildingIcon,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { DateInput } from "@/components/ui/date-input";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";

export interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedRoomId?: string;
  initialCheckIn?: Date;
  initialCheckOut?: Date;
  onSuccess?: () => void;
}

interface GuestState {
  id: string;
  name: string;
  fatherName: string;
  age: string;
  sex: "MALE" | "FEMALE" | "OTHER";
  mobile: string;
}

interface AccompanyingGuestError {
  name?: string;
  mobile?: string;
  age?: string;
  sex?: string;
}

export function BookingModal({
  open,
  onOpenChange,
  preselectedRoomId,
  initialCheckIn,
  initialCheckOut,
  onSuccess,
}: BookingModalProps) {
  const router = useRouter();

  // ───────── Step Management ─────────
  const [step, setStep] = useState<"INFO" | "PAYMENT" | "CONFIRMATION">("INFO");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [graceMinutes, setGraceMinutes] = useState(0);
  const [roomTypes, setRoomTypes] = useState<Array<{ id: string; name: string }>>([]);

  // ───────── Step 1: Stay Dates (DD/MM/YYYY + Time) ─────────
  const defaultIn = initialCheckIn || new Date();
  const defaultOut =
    initialCheckOut || new Date(defaultIn.getTime() + 24 * 60 * 60 * 1000);

  const [checkInDate, setCheckInDate] = useState<string>(() =>
    formatIST(defaultIn, "yyyy-MM-dd")
  );
  const [checkInTime, setCheckInTime] = useState<string>(() =>
    formatIST(defaultIn, "HH:mm")
  );
  const [checkOutDate, setCheckOutDate] = useState<string>(() =>
    formatIST(defaultOut, "yyyy-MM-dd")
  );
  const [checkOutTime, setCheckOutTime] = useState<string>(() =>
    formatIST(defaultOut, "HH:mm")
  );

  const checkInStr = useMemo(
    () => `${checkInDate}T${checkInTime || "12:00"}`,
    [checkInDate, checkInTime]
  );
  const checkOutStr = useMemo(
    () => `${checkOutDate}T${checkOutTime || "12:00"}`,
    [checkOutDate, checkOutTime]
  );

  // ───────── Step 1: Rooms ─────────
  const [rooms, setRooms] = useState<AvailableRoomResult[]>([]);
  const [isSearchingRooms, setIsSearchingRooms] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(() =>
    preselectedRoomId ? [preselectedRoomId] : []
  );
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>("");
  const [customRates, setCustomRates] = useState<Record<string, string>>({});

  // ───────── Step 1: Primary Guest Details ─────────
  const [primaryGuest, setPrimaryGuest] = useState<GuestState>({
    id: "guest-primary",
    name: "",
    fatherName: "",
    age: "",
    sex: "MALE",
    mobile: "",
  });

  // ───────── Step 1: Accompanying Guests ─────────
  const [accompanyingGuests, setAccompanyingGuests] = useState<GuestState[]>([]);

  // ───────── Step 1: Visit Information ─────────
  const [bookingSource, setBookingSource] = useState<
    "WALK_IN" | "PHONE" | "REFERRAL" | "ONLINE" | "CORPORATE" | "OTHER"
  >("WALK_IN");
  const [arrivingFrom, setArrivingFrom] = useState("");
  const [purposeOfVisit, setPurposeOfVisit] = useState("");

  // ───────── Step 1: Corporate GST Details ─────────
  const [showCorporate, setShowCorporate] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");

  // ───────── Validation Errors ─────────
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [accompanyingErrors, setAccompanyingErrors] = useState<
    Record<string, AccompanyingGuestError>
  >({});

  // ───────── Step 2: Financials ─────────
  const [discountStr, setDiscountStr] = useState("0");
  const [advanceAmountStr, setAdvanceAmountStr] = useState("");
  const [advanceMode, setAdvanceMode] = useState<
    "CASH" | "UPI" | "CARD" | "BANK_TRANSFER"
  >("CASH");

  // ───────── Step 3: Confirmation Data ─────────
  const [createdBooking, setCreatedBooking] = useState<{
    reference: string;
    status: string;
    roomNumber: string;
    roomTypeName: string;
    primaryGuestName: string;
    accompanyingGuestNames?: string[];
    advancePaid: number;
    balanceDue: number;
    checkInFormatted: string;
    checkOutFormatted: string;
    groupBookingId?: string | null;
    groupRoomCount?: number;
  } | null>(null);

  // Sync preselected room ID if changed
  const [prevPreselectedRoomId, setPrevPreselectedRoomId] = useState(preselectedRoomId);
  if (preselectedRoomId !== prevPreselectedRoomId) {
    setPrevPreselectedRoomId(preselectedRoomId);
    if (preselectedRoomId && !selectedRoomIds.includes(preselectedRoomId)) {
      setSelectedRoomIds((prev) => [...prev, preselectedRoomId]);
    }
  }

  // Load initial settings and room types once
  useEffect(() => {
    if (!open) return;
    listRoomTypesAction().then((res) => {
      if (res.ok && res.data) setRoomTypes(res.data);
    });
    getBookingSettingsAction().then((res) => {
      if (res.ok && res.data) setGraceMinutes(res.data.graceMinutes);
    });
  }, [open]);

  // Calculate stay duration
  const currentStay: StayCalculationResult = useMemo(() => {
    try {
      const start = fromISTInput(checkInStr);
      const end = fromISTInput(checkOutStr);
      if (end.getTime() > start.getTime()) {
        return calculateStay(start, end, graceMinutes);
      }
    } catch {
      // Fallback
    }
    return {
      days: 1,
      hours: 24,
      minutes: 1440,
      elapsedMs: 86400000,
      graceMinutes,
      isGracePeriodApplied: false,
    };
  }, [checkInStr, checkOutStr, graceMinutes]);

  // Query available rooms whenever dates change and modal is open
  useEffect(() => {
    if (!open) return;
    let isCurrent = true;

    Promise.resolve().then(async () => {
      if (!isCurrent) return;
      setIsSearchingRooms(true);
      try {
        const start = fromISTInput(checkInStr);
        const end = fromISTInput(checkOutStr);

        if (end.getTime() <= start.getTime()) {
          setErrors((prev) => ({
            ...prev,
            dates: "Check-out time must be strictly after check-in time.",
          }));
          return;
        }

        setErrors((prev) => {
          const copy = { ...prev };
          delete copy.dates;
          return copy;
        });

        const res = await findAvailableRoomsAction(
          start.toISOString(),
          end.toISOString()
        );
        if (isCurrent && res.ok && res.data) {
          setRooms(res.data.rooms);
        }
      } catch (err) {
        console.error("Error querying rooms:", err);
      } finally {
        if (isCurrent) {
          setIsSearchingRooms(false);
        }
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [open, checkInStr, checkOutStr]);

  // ───────── Room Selection Helpers ─────────
  const selectedRooms = useMemo(() => {
    return rooms.filter((r) => selectedRoomIds.includes(r.id));
  }, [rooms, selectedRoomIds]);

  // Room Type Options for Dropdown A
  const roomTypeOptions = useMemo(() => {
    const totalAvailCount = rooms.filter(
      (r) => r.isAvailable && !selectedRoomIds.includes(r.id)
    ).length;

    const allTypesOption = {
      value: "ALL",
      label: "All Types",
      badge: `${totalAvailCount} Available`,
    };

    const typeOptions = roomTypes.map((t) => {
      const availCount = rooms.filter(
        (r) =>
          r.typeId === t.id &&
          r.isAvailable &&
          !selectedRoomIds.includes(r.id)
      ).length;
      return {
        value: t.id,
        label: t.name,
        badge: `${availCount} Available`,
      };
    });

    return [allTypesOption, ...typeOptions];
  }, [roomTypes, rooms, selectedRoomIds]);

  // Room Number Options for Dropdown B
  const roomNumberOptions = useMemo(() => {
    if (!selectedRoomTypeId) return [];

    if (selectedRoomTypeId === "ALL") {
      return rooms
        .filter((r) => r.isAvailable && !selectedRoomIds.includes(r.id))
        .map((r) => ({
          value: r.id,
          label: `Room ${r.number}`,
          sublabel: `${r.typeName} • ${formatINR(r.pricePerNight)} / night`,
        }));
    }

    return rooms
      .filter(
        (r) =>
          r.typeId === selectedRoomTypeId &&
          r.isAvailable &&
          !selectedRoomIds.includes(r.id)
      )
      .map((r) => ({
        value: r.id,
        label: `Room ${r.number}`,
        sublabel: `${formatINR(r.pricePerNight)} / night`,
      }));
  }, [rooms, selectedRoomTypeId, selectedRoomIds]);

  const handleSelectRoomNumber = (roomId: string) => {
    if (!selectedRoomIds.includes(roomId)) {
      setSelectedRoomIds((prev) => [...prev, roomId]);
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.rooms;
        return copy;
      });
    }
  };

  const handleRemoveRoom = (roomId: string) => {
    setSelectedRoomIds((prev) => prev.filter((id) => id !== roomId));
    setCustomRates((prev) => {
      const copy = { ...prev };
      delete copy[roomId];
      return copy;
    });
  };

  // ───────── Financial Calculations ─────────
  const totalRoomTariffPerNight = useMemo(() => {
    return selectedRooms.reduce((acc, r) => {
      const custom = customRates[r.id];
      const rate =
        custom !== undefined && custom !== "" && !isNaN(Number(custom))
          ? Number(custom)
          : r.pricePerNight;
      return acc + rate;
    }, 0);
  }, [selectedRooms, customRates]);

  const stayDays = Math.max(1, currentStay.days);
  const roomCharges = totalRoomTariffPerNight * stayDays;
  const discount = Math.max(0, Number(discountStr) || 0);
  const taxableAmount = Math.max(0, roomCharges - discount);

  const maxRoomRate = useMemo(() => {
    if (selectedRooms.length === 0) return 0;
    return Math.max(
      ...selectedRooms.map((r) => {
        const custom = customRates[r.id];
        return custom !== undefined && custom !== "" && !isNaN(Number(custom))
          ? Number(custom)
          : r.pricePerNight;
      })
    );
  }, [selectedRooms, customRates]);

  // GST slab: 18% if max nightly rate > ₹7500, else 5%
  const gstPercent = maxRoomRate > 7500 ? 18 : 5;
  const cgstAmount =
    Math.round(((taxableAmount * gstPercent) / 200) * 100) / 100;
  const sgstAmount = cgstAmount;
  const totalGst = cgstAmount + sgstAmount;
  const totalBill = Math.round(taxableAmount + totalGst);
  const advanceAmount = Math.max(0, Number(advanceAmountStr) || 0);
  const balanceDue = Math.max(0, totalBill - advanceAmount);

  // ───────── Step 1 Validation ─────────
  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    const accErrs: Record<string, AccompanyingGuestError> = {};

    // 1. Dates
    try {
      const start = fromISTInput(checkInStr);
      const end = fromISTInput(checkOutStr);
      if (end.getTime() <= start.getTime()) {
        errs.dates = "Check-out time must be strictly after check-in time.";
      }
    } catch {
      errs.dates = "Please enter valid check-in and check-out dates.";
    }

    // 2. Room Selection
    if (selectedRoomIds.length === 0) {
      errs.rooms = "Please select at least one room.";
    }

    // 3. Primary Guest Details (Mandatory: Name, Mobile, Age)
    if (!primaryGuest.name.trim()) {
      errs.primaryName = "Full name is required.";
    }

    if (!primaryGuest.mobile.trim()) {
      errs.primaryMobile = "Mobile number is required.";
    } else if (!/^[0-9+ -]{7,15}$/.test(primaryGuest.mobile.trim())) {
      errs.primaryMobile = "Please enter a valid mobile number (7-15 digits).";
    }

    if (!primaryGuest.age.trim()) {
      errs.primaryAge = "Age is required.";
    } else {
      const ageNum = Number(primaryGuest.age);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 125) {
        errs.primaryAge = "Please enter a valid age (1-125).";
      }
    }

    // 4. Accompanying Guests (Mandatory: Name, Mobile, Age, Sex)
    accompanyingGuests.forEach((guest) => {
      const gErr: AccompanyingGuestError = {};
      if (!guest.name.trim()) {
        gErr.name = "Full name is required.";
      }
      if (!guest.mobile.trim()) {
        gErr.mobile = "Mobile number is required.";
      } else if (!/^[0-9+ -]{7,15}$/.test(guest.mobile.trim())) {
        gErr.mobile = "Please enter a valid mobile number.";
      }
      if (!guest.age.trim()) {
        gErr.age = "Age is required.";
      } else {
        const aNum = Number(guest.age);
        if (isNaN(aNum) || aNum < 1 || aNum > 125) {
          gErr.age = "Please enter a valid age (1-125).";
        }
      }
      if (!guest.sex) {
        gErr.sex = "Sex is required.";
      }

      if (Object.keys(gErr).length > 0) {
        accErrs[guest.id] = gErr;
      }
    });

    // 5. Visit Information (Mandatory: Arriving From, Purpose of Visit)
    if (!arrivingFrom.trim()) {
      errs.arrivingFrom = "Arriving from location is required.";
    }

    if (!purposeOfVisit.trim()) {
      errs.purposeOfVisit = "Purpose of visit is required.";
    }

    // 6. Corporate GSTIN
    if (showCorporate && companyGstin.trim()) {
      if (
        !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
          companyGstin.trim().toUpperCase()
        )
      ) {
        errs.companyGstin =
          "Please enter a valid 15-character GSTIN (e.g. 19AAAAA0000A1Z5).";
      }
    }

    setErrors(errs);
    setAccompanyingErrors(accErrs);

    const hasErrors =
      Object.keys(errs).length > 0 || Object.keys(accErrs).length > 0;

    if (hasErrors) {
      if (errs.rooms) {
        toast.error("Please select at least one room.");
      } else {
        toast.error("Please fill in all mandatory fields before proceeding.");
      }
      return false;
    }

    return true;
  };

  const handleProceedToPayment = () => {
    if (!validateStep1()) return;
    setStep("PAYMENT");
  };

  // ───────── Step 2 Submission (RESERVE or CHECK_IN) ─────────
  const handleSubmitBooking = async (action: "RESERVE" | "CHECK_IN") => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const start = fromISTInput(checkInStr);
      const end = fromISTInput(checkOutStr);

      const guestsPayload = [
        {
          name: primaryGuest.name.trim(),
          fatherName: primaryGuest.fatherName.trim() || undefined,
          age: primaryGuest.age ? Number(primaryGuest.age) : undefined,
          sex: primaryGuest.sex,
          mobile: primaryGuest.mobile.trim() || undefined,
          isPrimary: true,
          allocatedRoomId: selectedRoomIds[0],
        },
        ...accompanyingGuests.map((g, idx) => ({
          name: g.name.trim(),
          fatherName: g.fatherName.trim() || undefined,
          age: g.age ? Number(g.age) : undefined,
          sex: g.sex,
          mobile: g.mobile.trim() || undefined,
          isPrimary: false,
          allocatedRoomId:
            selectedRoomIds[Math.min(idx + 1, selectedRoomIds.length - 1)],
        })),
      ];

      const roomsPayload = selectedRooms.map((r) => {
        const custom = customRates[r.id];
        const rate =
          custom !== undefined && custom !== "" && !isNaN(Number(custom))
            ? Number(custom)
            : r.pricePerNight;
        return {
          roomId: r.id,
          rateApplied: rate,
        };
      });

      const payload = {
        action,
        checkInAt: start,
        checkOutAt: end,
        rooms: roomsPayload,
        guests: guestsPayload,
        source: bookingSource,
        arrivingFrom: arrivingFrom.trim() || undefined,
        purposeOfVisit: purposeOfVisit.trim() || undefined,
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
        discount,
        advanceAmount,
        advanceMode: advanceAmount > 0 ? advanceMode : undefined,
      };

      const res = await createBookingAction(payload);
      if (!res.ok) {
        toast.error(res.message || "Failed to create booking");
        return;
      }

      toast.success(
        action === "CHECK_IN"
          ? "Check-in completed successfully!"
          : "Reservation saved successfully!"
      );

      const accNames = accompanyingGuests
        .map((g) => g.name.trim())
        .filter((n) => n.length > 0);

      setCreatedBooking({
        reference: res.data?.reference || "BK-SUCCESS",
        status: action === "CHECK_IN" ? "CHECKED_IN" : "RESERVED",
        roomNumber: selectedRooms.map((r) => r.number).join(", "),
        roomTypeName: selectedRooms.map((r) => r.typeName).join(", "),
        primaryGuestName: primaryGuest.name.trim(),
        accompanyingGuestNames: accNames.length > 0 ? accNames : undefined,
        advancePaid: advanceAmount,
        balanceDue,
        checkInFormatted: formatIST(start, "dd/MM/yyyy, hh:mm a"),
        checkOutFormatted: formatIST(end, "dd/MM/yyyy, hh:mm a"),
        groupBookingId: res.data?.groupBookingId,
        groupRoomCount:
          selectedRooms.length > 1 ? selectedRooms.length : undefined,
      });

      setStep("CONFIRMATION");
      onSuccess?.();
    } catch (err: unknown) {
      console.error("Booking error:", err);
      toast.error(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ───────── Modal Reset Lifecycle (Critical Bug Fix) ─────────
  const handleResetForm = () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    setCheckInDate(formatIST(now, "yyyy-MM-dd"));
    setCheckInTime(formatIST(now, "HH:mm"));
    setCheckOutDate(formatIST(tomorrow, "yyyy-MM-dd"));
    setCheckOutTime(formatIST(tomorrow, "HH:mm"));

    setSelectedRoomIds([]);
    setSelectedRoomTypeId("");
    setCustomRates({});

    setPrimaryGuest({
      id: "guest-primary",
      name: "",
      fatherName: "",
      age: "",
      sex: "MALE",
      mobile: "",
    });
    setAccompanyingGuests([]);
    setBookingSource("WALK_IN");
    setArrivingFrom("");
    setPurposeOfVisit("");

    setShowCorporate(false);
    setCompanyName("");
    setCompanyGstin("");
    setCompanyAddress("");

    setDiscountStr("0");
    setAdvanceAmountStr("");
    setAdvanceMode("CASH");

    setErrors({});
    setAccompanyingErrors({});

    setCreatedBooking(null);
    setStep("INFO");
  };

  const handleModalClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleResetForm();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent className="w-full sm:max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[92vh] max-w-full flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-xl shadow-2xl">
        {/* Modal Sticky Header */}
        <DialogHeader className="p-3.5 sm:p-5 border-b border-border bg-card shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pr-6">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="size-8 sm:size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CheckInIcon className="size-4 sm:size-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-xl font-bold tracking-tight text-foreground">
                  New Booking / Front Desk Check-in
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground line-clamp-1 sm:line-clamp-none">
                  {step === "INFO"
                    ? "Step 1: Dates, Rooms & Guest Details"
                    : step === "PAYMENT"
                    ? "Step 2: Bill Summary & Confirmation"
                    : "Booking successfully created"}
                </DialogDescription>
              </div>
            </div>

            {/* Stepper badge indicator */}
            {step !== "CONFIRMATION" && (
              <div className="flex items-center gap-1.5 self-start sm:self-auto text-xs">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold border",
                    step === "INFO"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  1. Information
                </span>
                <ChevronRightIcon className="size-3 text-muted-foreground" />
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold border",
                    step === "PAYMENT"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  2. Review & Pay
                </span>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6 custom-scrollbar bg-background">
          {/* ═══════════════ STEP 1: BOOKING INFORMATION ═══════════════ */}
          {step === "INFO" && (
            <div className="space-y-6">
              {/* Section 1: Stay Dates & Duration (DD/MM/YYYY) */}
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="size-4 text-primary" />
                    <h3 className="text-sm font-bold text-foreground tracking-wide">
                      Stay Dates & 24-Hour Duration
                    </h3>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {currentStay.days} {currentStay.days === 1 ? "Day" : "Days"} (
                    {currentStay.hours} hrs)
                  </Badge>
                </div>

                {errors.dates && (
                  <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                    <span className="font-semibold">Date error:</span>
                    <span>{errors.dates}</span>
                  </div>
                )}

                {/* Date Inputs Grid (DD/MM/YYYY) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Check-In */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="modalCheckInDate"
                      className="text-xs font-semibold text-foreground flex items-center justify-between"
                    >
                      <span>Check-In (IST)</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        DD/MM/YYYY &bull; 24-hr cycle
                      </span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <DateInput
                          id="modalCheckInDate"
                          value={checkInDate}
                          onChange={(val) => setCheckInDate(val)}
                          className="h-9 text-xs bg-background"
                          placeholder="DD/MM/YYYY"
                        />
                      </div>
                      <div className="w-28 shrink-0">
                        <Input
                          id="modalCheckInTime"
                          type="time"
                          value={checkInTime}
                          onChange={(e) => setCheckInTime(e.target.value)}
                          className="h-9 text-xs font-mono bg-background"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Check-Out */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="modalCheckOutDate"
                      className="text-xs font-semibold text-foreground flex items-center justify-between"
                    >
                      <span>Check-Out (IST)</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        DD/MM/YYYY &bull; Planned departure
                      </span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <DateInput
                          id="modalCheckOutDate"
                          value={checkOutDate}
                          onChange={(val) => setCheckOutDate(val)}
                          className="h-9 text-xs bg-background"
                          placeholder="DD/MM/YYYY"
                        />
                      </div>
                      <div className="w-28 shrink-0">
                        <Input
                          id="modalCheckOutTime"
                          type="time"
                          value={checkOutTime}
                          onChange={(e) => setCheckOutTime(e.target.value)}
                          className="h-9 text-xs font-mono bg-background"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Room Selection (Two Searchable Dropdowns) */}
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2">
                    <RoomIcon className="size-4 text-primary" />
                    <h3 className="text-sm font-bold text-foreground tracking-wide">
                      Choose Room(s)
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSearchingRooms ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <SpinnerIcon className="size-3.5 animate-spin" />
                        <span>Checking availability...</span>
                      </span>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs font-medium bg-status-available/10 text-status-available border-status-available/30"
                      >
                        {rooms.filter((r) => r.isAvailable).length} Available
                      </Badge>
                    )}
                  </div>
                </div>

                {errors.rooms && (
                  <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                    {errors.rooms}
                  </div>
                )}

                {/* Two Separate Searchable Dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Dropdown A: Room Type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      1. Select Room Type
                    </Label>
                    <SearchableDropdown
                      id="roomTypeSelect"
                      placeholder="Select Room Type..."
                      searchPlaceholder="Search room type..."
                      emptyMessage="No room types found."
                      value={selectedRoomTypeId}
                      options={roomTypeOptions}
                      onSelect={(val) => setSelectedRoomTypeId(val)}
                    />
                  </div>

                  {/* Dropdown B: Room Number */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      2. Select Room to Add
                    </Label>
                    <SearchableDropdown
                      id="roomNumberSelect"
                      placeholder={
                        selectedRoomTypeId
                          ? "Select room to add..."
                          : "Select room type first"
                      }
                      searchPlaceholder="Search room number..."
                      emptyMessage={
                        selectedRoomTypeId === "ALL"
                          ? "No available rooms found."
                          : "No available rooms of this type."
                      }
                      disabled={!selectedRoomTypeId}
                      options={roomNumberOptions}
                      onSelect={handleSelectRoomNumber}
                      retainValueDisplay={false}
                    />
                  </div>
                </div>

                {/* Selected Rooms Display Cards */}
                <div className="space-y-2 pt-2 border-t border-border/70">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Selected Rooms ({selectedRooms.length})</span>
                    {selectedRooms.length > 1 && (
                      <span className="text-primary font-mono text-[11px] font-bold uppercase">
                        Group Booking
                      </span>
                    )}
                  </div>

                  {selectedRooms.length === 0 ? (
                    <div className="p-4 rounded-lg border border-dashed border-border bg-muted/20 text-center text-xs text-muted-foreground">
                      No rooms selected yet. Select a room type and room number
                      above to add to this booking.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {selectedRooms.map((room) => {
                          const customVal = customRates[room.id] || "";
                          return (
                            <div
                              key={room.id}
                              className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border border-border bg-muted/30 shadow-2xs gap-2"
                            >
                              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 pr-1 flex-1">
                                <div className="size-8 rounded-md bg-primary text-primary-foreground font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                  {room.number}
                                </div>
                                <div className="truncate min-w-0">
                                  <div className="font-semibold text-xs text-foreground truncate">
                                    Room {room.number}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground truncate">
                                    {room.typeName}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                <div className="inline-flex items-center h-8 rounded-md border border-input bg-background px-1.5 sm:px-2 shadow-2xs focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                                  <span className="text-xs font-semibold text-muted-foreground select-none mr-0.5">
                                    ₹
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={
                                      customVal !== ""
                                        ? customVal
                                        : room.pricePerNight
                                    }
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setCustomRates((prev) => ({
                                        ...prev,
                                        [room.id]: v,
                                      }));
                                    }}
                                    className="w-14 sm:w-16 h-full px-0.5 text-xs font-mono font-bold text-right text-foreground bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    title="Custom Nightly Tariff (₹)"
                                  />
                                  <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground select-none ml-0.5">
                                    /night
                                  </span>
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveRoom(room.id)}
                                  className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0"
                                  title={`Remove Room ${room.number}`}
                                >
                                  <DeleteIcon className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Combined Nightly Tariff Banner */}
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs flex items-center justify-between text-primary font-medium">
                        <span>
                          Combined Nightly Tariff ({selectedRooms.length} room
                          {selectedRooms.length > 1 ? "s" : ""}):
                        </span>
                        <span className="font-mono font-bold text-sm">
                          {formatINR(totalRoomTariffPerNight)} / night
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Section 3: Guest & Visit Information */}
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2">
                    <GuestIcon className="size-4 text-primary" />
                    <h3 className="text-sm font-bold text-foreground tracking-wide">
                      Guest & Visit Information
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    1 Primary
                    {accompanyingGuests.length > 0
                      ? ` + ${accompanyingGuests.length} Accompanying`
                      : ""}
                  </Badge>
                </div>

                {/* Primary Guest Fields (Mandatory: Full Name, Mobile, Age) */}
                <div className="p-3.5 rounded-lg border border-border/70 bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Primary Guest Details *
                    </span>
                    <Badge variant="default" className="text-[10px] h-4">
                      Primary
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Full Name */}
                    <div className="space-y-1">
                      <Label htmlFor="primaryName" className="text-xs font-medium">
                        Full Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="primaryName"
                        placeholder="e.g. Rahul Sharma"
                        value={primaryGuest.name}
                        onChange={(e) => {
                          setPrimaryGuest((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }));
                          if (errors.primaryName) {
                            setErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.primaryName;
                              return copy;
                            });
                          }
                        }}
                        className={cn(
                          "h-9 text-xs bg-background",
                          errors.primaryName &&
                            "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {errors.primaryName && (
                        <p className="text-[11px] text-destructive">
                          {errors.primaryName}
                        </p>
                      )}
                    </div>

                    {/* Mobile Number */}
                    <div className="space-y-1">
                      <Label htmlFor="primaryMobile" className="text-xs font-medium">
                        Mobile Number <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="primaryMobile"
                        type="tel"
                        placeholder="10-digit mobile number"
                        value={primaryGuest.mobile}
                        onChange={(e) => {
                          setPrimaryGuest((prev) => ({
                            ...prev,
                            mobile: e.target.value,
                          }));
                          if (errors.primaryMobile) {
                            setErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.primaryMobile;
                              return copy;
                            });
                          }
                        }}
                        className={cn(
                          "h-9 text-xs bg-background font-mono",
                          errors.primaryMobile &&
                            "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {errors.primaryMobile && (
                        <p className="text-[11px] text-destructive">
                          {errors.primaryMobile}
                        </p>
                      )}
                    </div>

                    {/* Age */}
                    <div className="space-y-1">
                      <Label htmlFor="primaryAge" className="text-xs font-medium">
                        Age <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="primaryAge"
                        type="number"
                        min={1}
                        max={125}
                        placeholder="e.g. 32"
                        value={primaryGuest.age}
                        onChange={(e) => {
                          setPrimaryGuest((prev) => ({
                            ...prev,
                            age: e.target.value,
                          }));
                          if (errors.primaryAge) {
                            setErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.primaryAge;
                              return copy;
                            });
                          }
                        }}
                        className={cn(
                          "h-9 text-xs bg-background font-mono",
                          errors.primaryAge &&
                            "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {errors.primaryAge && (
                        <p className="text-[11px] text-destructive">
                          {errors.primaryAge}
                        </p>
                      )}
                    </div>

                    {/* Sex */}
                    <div className="space-y-1">
                      <Label htmlFor="primarySex" className="text-xs font-medium">
                        Sex
                      </Label>
                      <SelectDropdown
                        id="primarySex"
                        value={primaryGuest.sex}
                        onChange={(val) =>
                          setPrimaryGuest((prev) => ({
                            ...prev,
                            sex: val as "MALE" | "FEMALE" | "OTHER",
                          }))
                        }
                        options={[
                          { label: "Male", value: "MALE" },
                          { label: "Female", value: "FEMALE" },
                          { label: "Other", value: "OTHER" },
                        ]}
                        className="h-9"
                      />
                    </div>

                    {/* Father's Name (Optional) */}
                    <div className="space-y-1 sm:col-span-2">
                      <Label
                        htmlFor="primaryFatherName"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Father&apos;s Name (Optional)
                      </Label>
                      <Input
                        id="primaryFatherName"
                        placeholder="Father / Guardian Name"
                        value={primaryGuest.fatherName}
                        onChange={(e) =>
                          setPrimaryGuest((prev) => ({
                            ...prev,
                            fatherName: e.target.value,
                          }))
                        }
                        className="h-9 text-xs bg-background"
                      />
                    </div>
                  </div>
                </div>

                {/* Accompanying Guests Section */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Accompanying Guests ({accompanyingGuests.length})
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAccompanyingGuests((prev) => [
                          ...prev,
                          {
                            id: `guest-${Date.now()}`,
                            name: "",
                            fatherName: "",
                            age: "",
                            sex: "MALE",
                            mobile: "",
                          },
                        ]);
                      }}
                      className="h-7 text-xs gap-1 cursor-pointer"
                    >
                      <AddIcon className="size-3" />
                      <span>Add Accompanying Guest</span>
                    </Button>
                  </div>

                  {accompanyingGuests.map((guest, idx) => {
                    const gErr = accompanyingErrors[guest.id] || {};
                    return (
                      <div
                        key={guest.id}
                        className="p-3.5 rounded-lg border border-border/70 bg-muted/15 space-y-3 relative"
                      >
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                          <span className="text-xs font-semibold text-foreground">
                            Accompanying Guest {idx + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setAccompanyingGuests((prev) =>
                                prev.filter((g) => g.id !== guest.id)
                              );
                              setAccompanyingErrors((prev) => {
                                const copy = { ...prev };
                                delete copy[guest.id];
                                return copy;
                              });
                            }}
                            className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Remove guest"
                          >
                            <DeleteIcon className="size-3.5" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Guest Name */}
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              Full Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              placeholder="Guest Full Name"
                              value={guest.name}
                              onChange={(e) => {
                                const v = e.target.value;
                                setAccompanyingGuests((prev) =>
                                  prev.map((g) =>
                                    g.id === guest.id ? { ...g, name: v } : g
                                  )
                                );
                                if (gErr.name) {
                                  setAccompanyingErrors((prev) => {
                                    const copy = { ...prev };
                                    if (copy[guest.id]) {
                                      delete copy[guest.id].name;
                                    }
                                    return copy;
                                  });
                                }
                              }}
                              className={cn(
                                "h-9 text-xs bg-background",
                                gErr.name &&
                                  "border-destructive focus-visible:ring-destructive"
                              )}
                            />
                            {gErr.name && (
                              <p className="text-[11px] text-destructive">
                                {gErr.name}
                              </p>
                            )}
                          </div>

                          {/* Guest Mobile */}
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              Mobile Number <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              type="tel"
                              placeholder="10-digit mobile number"
                              value={guest.mobile}
                              onChange={(e) => {
                                const v = e.target.value;
                                setAccompanyingGuests((prev) =>
                                  prev.map((g) =>
                                    g.id === guest.id ? { ...g, mobile: v } : g
                                  )
                                );
                                if (gErr.mobile) {
                                  setAccompanyingErrors((prev) => {
                                    const copy = { ...prev };
                                    if (copy[guest.id]) {
                                      delete copy[guest.id].mobile;
                                    }
                                    return copy;
                                  });
                                }
                              }}
                              className={cn(
                                "h-9 text-xs bg-background font-mono",
                                gErr.mobile &&
                                  "border-destructive focus-visible:ring-destructive"
                              )}
                            />
                            {gErr.mobile && (
                              <p className="text-[11px] text-destructive">
                                {gErr.mobile}
                              </p>
                            )}
                          </div>

                          {/* Guest Age */}
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              Age <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              max={125}
                              placeholder="e.g. 28"
                              value={guest.age}
                              onChange={(e) => {
                                const v = e.target.value;
                                setAccompanyingGuests((prev) =>
                                  prev.map((g) =>
                                    g.id === guest.id ? { ...g, age: v } : g
                                  )
                                );
                                if (gErr.age) {
                                  setAccompanyingErrors((prev) => {
                                    const copy = { ...prev };
                                    if (copy[guest.id]) {
                                      delete copy[guest.id].age;
                                    }
                                    return copy;
                                  });
                                }
                              }}
                              className={cn(
                                "h-9 text-xs bg-background font-mono",
                                gErr.age &&
                                  "border-destructive focus-visible:ring-destructive"
                              )}
                            />
                            {gErr.age && (
                              <p className="text-[11px] text-destructive">
                                {gErr.age}
                              </p>
                            )}
                          </div>

                          {/* Guest Sex */}
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              Sex <span className="text-destructive">*</span>
                            </Label>
                            <SelectDropdown
                              value={guest.sex}
                              onChange={(val) =>
                                setAccompanyingGuests((prev) =>
                                  prev.map((g) =>
                                    g.id === guest.id
                                      ? {
                                          ...g,
                                          sex: val as "MALE" | "FEMALE" | "OTHER",
                                        }
                                      : g
                                  )
                                )
                              }
                              options={[
                                { label: "Male", value: "MALE" },
                                { label: "Female", value: "FEMALE" },
                                { label: "Other", value: "OTHER" },
                              ]}
                              className="h-9"
                            />
                            {gErr.sex && (
                              <p className="text-[11px] text-destructive">
                                {gErr.sex}
                              </p>
                            )}
                          </div>

                          {/* Guest Father's Name (Optional) */}
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs font-medium text-muted-foreground">
                              Father&apos;s Name (Optional)
                            </Label>
                            <Input
                              placeholder="Father / Guardian Name"
                              value={guest.fatherName}
                              onChange={(e) => {
                                const v = e.target.value;
                                setAccompanyingGuests((prev) =>
                                  prev.map((g) =>
                                    g.id === guest.id
                                      ? { ...g, fatherName: v }
                                      : g
                                  )
                                );
                              }}
                              className="h-9 text-xs bg-background"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Visit Details (Mandatory: Arriving From, Purpose of Visit) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/70">
                  <div className="space-y-1">
                    <Label htmlFor="modalSource" className="text-xs font-medium">
                      Booking Source
                    </Label>
                    <SelectDropdown
                      id="modalSource"
                      value={bookingSource}
                      onChange={(val) =>
                        setBookingSource(
                          val as
                            | "WALK_IN"
                            | "PHONE"
                            | "REFERRAL"
                            | "ONLINE"
                            | "CORPORATE"
                            | "OTHER"
                        )
                      }
                      options={[
                        { label: "Walk-in Desk", value: "WALK_IN" },
                        { label: "Phone Call", value: "PHONE" },
                        { label: "Online Portal", value: "ONLINE" },
                        { label: "Corporate", value: "CORPORATE" },
                        { label: "Guest Referral", value: "REFERRAL" },
                        { label: "Other", value: "OTHER" },
                      ]}
                      className="h-9"
                    />
                  </div>

                  {/* Arriving From (Mandatory) */}
                  <div className="space-y-1">
                    <Label htmlFor="modalArrivingFrom" className="text-xs font-medium">
                      Arriving From <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="modalArrivingFrom"
                      placeholder="e.g. Kolkata, Delhi, Mumbai"
                      value={arrivingFrom}
                      onChange={(e) => {
                        setArrivingFrom(e.target.value);
                        if (errors.arrivingFrom) {
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.arrivingFrom;
                            return copy;
                          });
                        }
                      }}
                      className={cn(
                        "h-9 text-xs bg-background",
                        errors.arrivingFrom &&
                          "border-destructive focus-visible:ring-destructive"
                      )}
                    />
                    {errors.arrivingFrom && (
                      <p className="text-[11px] text-destructive">
                        {errors.arrivingFrom}
                      </p>
                    )}
                  </div>

                  {/* Purpose of Visit (Mandatory) */}
                  <div className="space-y-1">
                    <Label htmlFor="modalPurpose" className="text-xs font-medium">
                      Purpose of Visit <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="modalPurpose"
                      placeholder="e.g. Business, Tour, Medical"
                      value={purposeOfVisit}
                      onChange={(e) => {
                        setPurposeOfVisit(e.target.value);
                        if (errors.purposeOfVisit) {
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.purposeOfVisit;
                            return copy;
                          });
                        }
                      }}
                      className={cn(
                        "h-9 text-xs bg-background",
                        errors.purposeOfVisit &&
                          "border-destructive focus-visible:ring-destructive"
                      )}
                    />
                    {errors.purposeOfVisit && (
                      <p className="text-[11px] text-destructive">
                        {errors.purposeOfVisit}
                      </p>
                    )}
                  </div>
                </div>

                {/* Optional Corporate / GST Details Toggle */}
                <div className="pt-2 border-t border-border/70 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold select-none text-foreground">
                    <input
                      type="checkbox"
                      checked={showCorporate}
                      onChange={(e) => setShowCorporate(e.target.checked)}
                      className="size-4 rounded accent-primary cursor-pointer"
                    />
                    <BuildingIcon className="size-3.5 text-primary" />
                    <span>Corporate / Business Billing (GST Invoice)</span>
                  </label>

                  {showCorporate && (
                    <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="companyName" className="text-xs font-medium">
                            Company Name
                          </Label>
                          <Input
                            id="companyName"
                            placeholder="e.g. Tata Consultancy Services"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="h-9 text-xs bg-background"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="companyGstin" className="text-xs font-medium">
                            Company GSTIN
                          </Label>
                          <Input
                            id="companyGstin"
                            placeholder="15-character GSTIN (e.g. 19AAAAA0000A1Z5)"
                            value={companyGstin}
                            onChange={(e) => setCompanyGstin(e.target.value.toUpperCase())}
                            className={cn(
                              "h-9 text-xs bg-background font-mono uppercase",
                              errors.companyGstin && "border-destructive"
                            )}
                            maxLength={15}
                          />
                          {errors.companyGstin && (
                            <p className="text-[11px] text-destructive">
                              {errors.companyGstin}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="companyAddress" className="text-xs font-medium">
                          Company Registered Address
                        </Label>
                        <Input
                          id="companyAddress"
                          placeholder="Registered billing address"
                          value={companyAddress}
                          onChange={(e) => setCompanyAddress(e.target.value)}
                          className="h-9 text-xs bg-background"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ STEP 2: REVIEW & PAYMENT ═══════════════ */}
          {step === "PAYMENT" && (
            <div className="space-y-6">
              {/* Summary Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Stay & Room Summary */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="size-4 text-primary" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Stay Duration & Room(s)
                      </h4>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {stayDays} {stayDays === 1 ? "Night" : "Nights"}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-In:</span>
                      <span className="font-semibold text-foreground font-mono">
                        {formatIST(fromISTInput(checkInStr), "dd/MM/yyyy, hh:mm a")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-Out:</span>
                      <span className="font-semibold text-foreground font-mono">
                        {formatIST(fromISTInput(checkOutStr), "dd/MM/yyyy, hh:mm a")}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-border/60">
                      <span className="text-muted-foreground block mb-1">
                        Assigned Room(s):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedRooms.map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-bold"
                          >
                            Room {r.number} ({r.typeName})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Guest Summary */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
                    <div className="flex items-center gap-2">
                      <GuestIcon className="size-4 text-primary" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Guest Information
                      </h4>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {bookingSource.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Primary Guest:</span>
                      <span className="font-bold text-foreground">
                        {primaryGuest.name} ({primaryGuest.age} yrs, {primaryGuest.sex})
                      </span>
                    </div>
                    {primaryGuest.mobile && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone:</span>
                        <span className="font-mono text-foreground">
                          {primaryGuest.mobile}
                        </span>
                      </div>
                    )}
                    {accompanyingGuests.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Accompanying:</span>
                        <span className="font-medium text-foreground">
                          {accompanyingGuests
                            .map((g) => g.name || "Guest")
                            .join(", ")}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Origin:</span>
                      <span className="font-medium text-foreground">
                        {arrivingFrom}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purpose:</span>
                      <span className="font-medium text-foreground">
                        {purposeOfVisit}
                      </span>
                    </div>
                    {showCorporate && companyName && (
                      <div className="pt-2 border-t border-border/60 flex justify-between">
                        <span className="text-muted-foreground">Company:</span>
                        <span className="font-semibold text-primary truncate max-w-44">
                          {companyName} {companyGstin && `(${companyGstin})`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bill Breakdown & Advance Payment */}
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2">
                    <RupeeIcon className="size-4 text-primary" />
                    <h3 className="text-sm font-bold text-foreground tracking-wide">
                      Bill Breakdown & Advance Settlement
                    </h3>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    GST Slab: {gstPercent}%
                  </Badge>
                </div>

                {/* Calculation Rows */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">
                      Room Tariff ({stayDays} night{stayDays > 1 ? "s" : ""} ×{" "}
                      {formatINR(totalRoomTariffPerNight)}):
                    </span>
                    <span className="font-mono font-semibold text-foreground text-sm">
                      {formatINR(roomCharges)}
                    </span>
                  </div>

                  {/* Discount Input */}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Discount (₹):</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground font-mono">- ₹</span>
                      <Input
                        type="number"
                        min={0}
                        max={roomCharges}
                        value={discountStr}
                        onChange={(e) => setDiscountStr(e.target.value)}
                        className="w-24 h-8 text-xs font-mono text-right bg-background"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Taxable Value:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatINR(taxableAmount)}
                    </span>
                  </div>

                  {/* GST Breakdown */}
                  <div className="pl-3 border-l-2 border-primary/40 space-y-1.5 py-1 text-[11px] text-muted-foreground">
                    <div className="flex justify-between">
                      <span>CGST ({gstPercent / 2}%):</span>
                      <span className="font-mono">{formatINR(cgstAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST ({gstPercent / 2}%):</span>
                      <span className="font-mono">{formatINR(sgstAmount)}</span>
                    </div>
                  </div>

                  {/* Total Bill */}
                  <div className="flex justify-between items-center pt-2 border-t border-border font-bold text-sm">
                    <span className="text-foreground">Total Stay Bill:</span>
                    <span className="font-mono text-primary text-base">
                      {formatINR(totalBill)}
                    </span>
                  </div>

                  {/* Advance Payment Input */}
                  <div className="p-3.5 rounded-lg bg-muted/30 border border-border space-y-3 mt-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <span className="font-bold text-foreground text-xs block">
                          Record Advance Payment
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Amount deposited by guest at check-in / booking
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground font-mono text-xs">
                          ₹
                        </span>
                        <Input
                          type="number"
                          min={0}
                          max={totalBill}
                          placeholder="0"
                          value={advanceAmountStr}
                          onChange={(e) => setAdvanceAmountStr(e.target.value)}
                          className="w-32 h-8 text-xs font-mono font-bold text-right bg-background"
                        />
                      </div>
                    </div>

                    {advanceAmount > 0 && (
                      <div className="flex items-center justify-between pt-2 border-t border-border/70 text-xs">
                        <span className="text-muted-foreground font-medium">
                          Payment Mode:
                        </span>
                        <SelectDropdown
                          value={advanceMode}
                          onChange={(val) =>
                            setAdvanceMode(
                              val as "CASH" | "UPI" | "CARD" | "BANK_TRANSFER"
                            )
                          }
                          options={[
                            { label: "Cash", value: "CASH" },
                            { label: "UPI / QR", value: "UPI" },
                            { label: "Credit/Debit Card", value: "CARD" },
                            { label: "Bank Transfer", value: "BANK_TRANSFER" },
                          ]}
                          className="h-8 w-40"
                        />
                      </div>
                    )}
                  </div>

                  {/* Final Balance Due */}
                  <div className="flex justify-between items-center pt-2 border-t border-border font-bold text-sm">
                    <span className="text-foreground">Balance Due on Arrival:</span>
                    <span
                      className={cn(
                        "font-mono text-base",
                        balanceDue > 0
                          ? "text-destructive"
                          : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {formatINR(balanceDue)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ STEP 3: CONFIRMATION MODAL ═══════════════ */}
          {step === "CONFIRMATION" && createdBooking && (
            <div className="py-4 space-y-6 max-w-lg mx-auto text-center">
              {/* Emerald Success Icon */}
              <div className="size-16 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 flex items-center justify-center mx-auto shadow-xs">
                <CheckIcon className="size-8 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {createdBooking.status === "CHECKED_IN"
                    ? "Guest Checked In Successfully!"
                    : "Reservation Confirmed!"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {createdBooking.status === "CHECKED_IN"
                    ? "The room has been assigned and the guest stay is now officially active."
                    : "The reservation has been secured and logged in property records."}
                </p>
              </div>

              {/* Confirmation Details Card */}
              <div className="p-4 sm:p-5 rounded-xl bg-muted/40 border border-border space-y-3 text-xs text-left shadow-2xs font-mono">
                <div className="flex justify-between items-center pb-2 border-b border-border/70">
                  <span className="font-sans text-muted-foreground">
                    Booking Reference
                  </span>
                  <span className="font-bold text-primary text-sm flex items-center gap-1.5">
                    {createdBooking.reference}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-sans text-muted-foreground">
                    Assigned Room(s)
                  </span>
                  <span className="font-bold text-foreground font-sans">
                    {createdBooking.roomNumber} ({createdBooking.roomTypeName})
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-sans text-muted-foreground">
                    Stay Window
                  </span>
                  <span className="font-medium text-foreground font-sans text-right">
                    {createdBooking.checkInFormatted} &rarr;{" "}
                    {createdBooking.checkOutFormatted}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-sans text-muted-foreground">
                    Primary Guest
                  </span>
                  <span className="font-semibold text-foreground font-sans">
                    {createdBooking.primaryGuestName}
                  </span>
                </div>

                {/* Accompanying Guests (Only displayed if added) */}
                {createdBooking.accompanyingGuestNames &&
                  createdBooking.accompanyingGuestNames.length > 0 && (
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-sans text-muted-foreground">
                        Accompanying Guests
                      </span>
                      <span className="font-medium text-foreground font-sans text-right">
                        {createdBooking.accompanyingGuestNames.join(", ")}
                      </span>
                    </div>
                  )}

                {createdBooking.advancePaid > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                    <span className="font-sans">Advance Received</span>
                    <span className="font-bold">
                      {formatINR(createdBooking.advancePaid)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-border text-sm font-sans font-bold">
                  <span>Balance Due</span>
                  <span
                    className={cn(
                      "font-mono",
                      createdBooking.balanceDue > 0
                        ? "text-destructive"
                        : "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {formatINR(createdBooking.balanceDue)}
                  </span>
                </div>
              </div>

              {/* Confirmation Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    handleResetForm();
                    onOpenChange(false);
                    router.push("/rooms");
                  }}
                  className="flex-1 h-10 font-semibold cursor-pointer"
                >
                  <RoomIcon className="size-4 mr-1.5" />
                  <span>Go to Rooms Grid</span>
                </Button>

                <Button
                  type="button"
                  onClick={handleResetForm}
                  className="flex-1 h-10 font-semibold shadow-xs cursor-pointer"
                >
                  <AddIcon className="size-4 mr-1.5" />
                  <span>New Booking</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Sticky Footer */}
        {/* Modal Sticky Bottom Actions */}
        {step !== "CONFIRMATION" && (
          <div className="p-3 sm:p-5 border-t border-border bg-card flex items-center justify-between gap-2 sm:gap-3 shrink-0 sticky bottom-0 z-10 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-5 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
            {step === "INFO" ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleModalClose(false)}
                  className="text-xs cursor-pointer h-8 sm:h-9 px-2 sm:px-3"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={handleProceedToPayment}
                  className="gap-1.5 text-xs font-semibold shadow-xs cursor-pointer h-8 sm:h-9 px-3 sm:px-4"
                >
                  <span>Proceed to Review & Payment</span>
                  <ChevronRightIcon className="size-3.5" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep("INFO")}
                  disabled={isSubmitting}
                  className="gap-1 text-xs cursor-pointer shrink-0 h-8 sm:h-9 px-2 sm:px-3"
                >
                  <ChevronLeftIcon className="size-3.5" />
                  <span className="hidden sm:inline">Back to Edit Info</span>
                  <span className="sm:hidden">Back</span>
                </Button>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => handleSubmitBooking("RESERVE")}
                    className="gap-1 sm:gap-1.5 text-xs font-semibold border-status-reserved/40 text-status-reserved hover:bg-status-reserved/10 cursor-pointer h-8 sm:h-9 px-2 sm:px-3"
                  >
                    {isSubmitting ? (
                      <SpinnerIcon className="size-3.5 animate-spin" />
                    ) : (
                      <CalendarIcon className="size-3.5" />
                    )}
                    <span className="hidden sm:inline">Save as Reservation</span>
                    <span className="sm:hidden">Reserve</span>
                  </Button>

                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => handleSubmitBooking("CHECK_IN")}
                    className="gap-1 sm:gap-1.5 text-xs font-semibold shadow-xs cursor-pointer h-8 sm:h-9 px-2.5 sm:px-3"
                  >
                    {isSubmitting ? (
                      <SpinnerIcon className="size-3.5 animate-spin" />
                    ) : (
                      <CheckInIcon className="size-3.5" />
                    )}
                    <span className="hidden sm:inline">Check In Now</span>
                    <span className="sm:hidden">Check In</span>
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
