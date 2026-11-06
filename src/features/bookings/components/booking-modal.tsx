"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  ClockIcon,
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  // Sync initialCheckIn and initialCheckOut if props change while modal is open
  const [prevInitialCheckIn, setPrevInitialCheckIn] = useState(initialCheckIn);
  const [prevInitialCheckOut, setPrevInitialCheckOut] = useState(initialCheckOut);
  if (initialCheckIn !== prevInitialCheckIn || initialCheckOut !== prevInitialCheckOut) {
    setPrevInitialCheckIn(initialCheckIn);
    setPrevInitialCheckOut(initialCheckOut);
    const dIn = initialCheckIn || new Date();
    const dOut = initialCheckOut || new Date(dIn.getTime() + 24 * 60 * 60 * 1000);
    setCheckInDate(formatIST(dIn, "yyyy-MM-dd"));
    setCheckInTime(formatIST(dIn, "HH:mm"));
    setCheckOutDate(formatIST(dOut, "yyyy-MM-dd"));
    setCheckOutTime(formatIST(dOut, "HH:mm"));
  }

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
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>("ALL");
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

  // Auto-scroll modal body to top when step changes
  useEffect(() => {
    if (typeof scrollContainerRef.current?.scrollTo === "function") {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [step]);

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

  // Quick-set duration helper (1 Day, 2 Days, 3 Days)
  const handleQuickStayDays = (daysToAdd: number) => {
    try {
      const start = fromISTInput(checkInStr);
      const nextOut = new Date(start.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      setCheckOutDate(formatIST(nextOut, "yyyy-MM-dd"));
      setCheckOutTime(checkInTime || formatIST(nextOut, "HH:mm"));
      if (errors.dates) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.dates;
          return next;
        });
      }
    } catch {
      // Ignore if checkIn is invalid
    }
  };

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
      label: "All Room Types",
      badge: `${totalAvailCount} Avail`,
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
        badge: `${availCount} Avail`,
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
      errs.primaryMobile = "Enter a valid mobile number (7-15 digits).";
    }

    if (!primaryGuest.age.trim()) {
      errs.primaryAge = "Required";
    } else {
      const ageNum = Number(primaryGuest.age);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 125) {
        errs.primaryAge = "1-125 yrs";
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
        gErr.mobile = "Enter a valid mobile number.";
      }
      if (!guest.age.trim()) {
        gErr.age = "Required";
      } else {
        const aNum = Number(guest.age);
        if (isNaN(aNum) || aNum < 1 || aNum > 125) {
          gErr.age = "1-125 yrs";
        }
      }
      if (!guest.sex) {
        gErr.sex = "Required";
      }

      if (Object.keys(gErr).length > 0) {
        accErrs[guest.id] = gErr;
      }
    });

    // 5. Visit Information (Mandatory: Arriving From, Purpose of Visit)
    if (!arrivingFrom.trim()) {
      errs.arrivingFrom = "Origin city/location is required.";
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
          "Enter a valid 15-character GSTIN (e.g. 19AAAAA0000A1Z5).";
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
        toast.error("Please complete all highlighted mandatory fields.");
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

  // ───────── Modal Reset Lifecycle ─────────
  const handleResetForm = () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    setCheckInDate(formatIST(now, "yyyy-MM-dd"));
    setCheckInTime(formatIST(now, "HH:mm"));
    setCheckOutDate(formatIST(tomorrow, "yyyy-MM-dd"));
    setCheckOutTime(formatIST(tomorrow, "HH:mm"));

    setSelectedRoomIds([]);
    setSelectedRoomTypeId("ALL");
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
      <DialogContent className="w-full sm:max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[92vh] max-w-full flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border">
        {/* ───────── Sticky Modal Header ───────── */}
        <DialogHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b border-border bg-card/95 backdrop-blur-xs shrink-0 z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pr-7 sm:pr-6">
            <div className="flex items-center gap-2.5">
              <div className="size-9 sm:size-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-2xs">
                <CheckInIcon className="size-4 sm:size-5" />
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
                  New Booking & Front Desk Check-In
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate">
                  {step === "INFO"
                    ? "Step 1 of 2 — Stay dates, room assignment & guest profile"
                    : step === "PAYMENT"
                      ? "Step 2 of 2 — Review tariff, taxes & record advance"
                      : "Booking confirmed & logged"}
                </DialogDescription>
              </div>
            </div>

            {/* Interactive Stepper Indicator */}
            {step !== "CONFIRMATION" && (
              <div className="flex items-center gap-1.5 self-start sm:self-auto bg-muted/60 p-1 rounded-lg border border-border/70">
                <button
                  type="button"
                  onClick={() => step === "PAYMENT" && setStep("INFO")}
                  disabled={step === "INFO"}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                    step === "INFO"
                      ? "bg-background text-foreground shadow-2xs border border-border/80"
                      : "text-muted-foreground hover:text-foreground cursor-pointer"
                  )}
                >
                  <span
                    className={cn(
                      "size-4 rounded-full text-[10px] flex items-center justify-center font-bold",
                      step === "INFO"
                        ? "bg-primary text-primary-foreground"
                        : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {step === "PAYMENT" ? <CheckIcon className="size-2.5 stroke-[3]" /> : "1"}
                  </span>
                  <span>Guest & Rooms</span>
                </button>

                <ChevronRightIcon className="size-3 text-muted-foreground/60 shrink-0" />

                <button
                  type="button"
                  onClick={() => step === "INFO" && handleProceedToPayment()}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                    step === "PAYMENT"
                      ? "bg-background text-foreground shadow-2xs border border-border/80"
                      : "text-muted-foreground hover:text-foreground cursor-pointer"
                  )}
                >
                  <span
                    className={cn(
                      "size-4 rounded-full text-[10px] flex items-center justify-center font-bold",
                      step === "PAYMENT"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted-foreground/20 text-muted-foreground"
                    )}
                  >
                    2
                  </span>
                  <span>Billing & Pay</span>
                </button>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* ───────── Scrollable Form Body ───────── */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-3.5 py-4 sm:p-6 space-y-4 sm:space-y-5 custom-scrollbar bg-muted/15"
        >
          {/* ═══════════════ STEP 1: BOOKING INFORMATION ═══════════════ */}
          {step === "INFO" && (
            <div className="space-y-4 sm:space-y-5">
              {/* ─── Card 1: Stay Dates & Duration ─── */}
              <section className="rounded-xl border border-border bg-card p-3.5 sm:p-5 space-y-3.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                      <CalendarIcon className="size-3.5" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-foreground tracking-tight">
                      Stay Schedule
                    </h3>
                  </div>

                  <Badge variant="secondary" className="font-mono text-[11px] px-2 py-0.5">
                    {currentStay.days} {currentStay.days === 1 ? "Night" : "Nights"} ({currentStay.hours}h)
                  </Badge>
                </div>

                {/* Duration Presets */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/60">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <ClockIcon className="size-3.5 text-muted-foreground" />
                    Stay Duration:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { days: 1, label: "1 Day" },
                      { days: 2, label: "2 Days" },
                      { days: 3, label: "3 Days" },
                    ].map((preset) => {
                      const isSelected =
                        currentStay.days === preset.days &&
                        !errors.dates &&
                        Math.round(currentStay.hours) === preset.days * 24;
                      return (
                        <button
                          key={preset.days}
                          type="button"
                          onClick={() => handleQuickStayDays(preset.days)}
                          className={cn(
                            "px-3 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "bg-background text-foreground border-border/80 hover:bg-muted"
                          )}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {errors.dates && (
                  <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive text-xs flex items-center gap-2 font-medium">
                    <span>{errors.dates}</span>
                  </div>
                )}

                {/* Check-In & Check-Out Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                  {/* Check-In Box */}
                  <div className="p-3 rounded-lg bg-muted/25 border border-border/70 space-y-2">
                    <Label
                      htmlFor="modalCheckInDate"
                      className="text-xs font-semibold text-foreground flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Check-In (IST)
                      </span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        24-hr cycle
                      </span>
                    </Label>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-7 sm:col-span-8">
                        <DateInput
                          id="modalCheckInDate"
                          value={checkInDate}
                          onChange={(val) => setCheckInDate(val)}
                          className="h-10 sm:h-9 text-xs bg-background w-full"
                          placeholder="DD/MM/YYYY"
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-4">
                        <Input
                          id="modalCheckInTime"
                          type="time"
                          value={checkInTime}
                          onChange={(e) => setCheckInTime(e.target.value)}
                          className="h-10 sm:h-9 w-full min-w-0 px-2.5 text-xs sm:text-sm font-mono bg-background"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Check-Out Box */}
                  <div className="p-3 rounded-lg bg-muted/25 border border-border/70 space-y-2">
                    <Label
                      htmlFor="modalCheckOutDate"
                      className="text-xs font-semibold text-foreground flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        Check-Out (IST)
                      </span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        Planned departure
                      </span>
                    </Label>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-7 sm:col-span-8">
                        <DateInput
                          id="modalCheckOutDate"
                          value={checkOutDate}
                          onChange={(val) => setCheckOutDate(val)}
                          className="h-10 sm:h-9 text-xs bg-background w-full"
                          placeholder="DD/MM/YYYY"
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-4">
                        <Input
                          id="modalCheckOutTime"
                          type="time"
                          value={checkOutTime}
                          onChange={(e) => setCheckOutTime(e.target.value)}
                          className="h-10 sm:h-9 w-full min-w-0 px-2.5 text-xs sm:text-sm font-mono bg-background"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ─── Card 2: Room Selection ─── */}
              <section
                className={cn(
                  "rounded-xl border bg-card p-3.5 sm:p-5 space-y-4 shadow-2xs transition-colors",
                  errors.rooms ? "border-destructive/60" : "border-border"
                )}
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                      <RoomIcon className="size-3.5" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-foreground tracking-tight">
                      Room Assignment <span className="text-destructive">*</span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSearchingRooms ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <SpinnerIcon className="size-3.5 animate-spin text-primary" />
                        <span className="hidden xs:inline">Checking availability...</span>
                      </span>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[11px] font-semibold bg-status-available/10 text-status-available border-status-available/30"
                      >
                        {rooms.filter((r) => r.isAvailable).length} Vacant
                      </Badge>
                    )}
                  </div>
                </div>

                {errors.rooms && (
                  <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive text-xs font-medium">
                    {errors.rooms}
                  </div>
                )}

                {/* Two Searchable Dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      1. Filter by Room Category
                    </Label>
                    <SearchableDropdown
                      id="roomTypeSelect"
                      placeholder="Select Room Type..."
                      searchPlaceholder="Search category..."
                      emptyMessage="No categories found."
                      value={selectedRoomTypeId}
                      options={roomTypeOptions}
                      onSelect={(val) => setSelectedRoomTypeId(val)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      2. Pick Room Number to Add
                    </Label>
                    <SearchableDropdown
                      id="roomNumberSelect"
                      placeholder={
                        selectedRoomTypeId
                          ? "Tap to add a room..."
                          : "Choose a category first"
                      }
                      searchPlaceholder="Type room number (e.g. 101)..."
                      emptyMessage={
                        selectedRoomTypeId === "ALL"
                          ? "No vacant rooms for these dates."
                          : "No vacant rooms in this category."
                      }
                      disabled={!selectedRoomTypeId}
                      options={roomNumberOptions}
                      onSelect={handleSelectRoomNumber}
                      retainValueDisplay={false}
                    />
                  </div>
                </div>

                {/* Selected Rooms List */}
                <div className="space-y-2.5 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">
                      Assigned Rooms ({selectedRooms.length})
                    </span>
                    {selectedRooms.length > 1 && (
                      <Badge variant="default" className="text-[10px] h-5 uppercase tracking-wider">
                        Group Booking ({selectedRooms.length} Rooms)
                      </Badge>
                    )}
                  </div>

                  {selectedRooms.length === 0 ? (
                    <div className="py-5 px-4 rounded-xl border border-dashed border-border bg-muted/20 text-center space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        No rooms assigned yet
                      </p>
                      <p className="text-[11px] text-muted-foreground/80">
                        Use the dropdown above to assign one or more vacant rooms.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {selectedRooms.map((room) => {
                          const customVal = customRates[room.id] || "";
                          return (
                            <div
                              key={room.id}
                              className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl border border-primary/25 bg-primary/[0.03] shadow-2xs gap-2 transition-all hover:border-primary/40"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="size-9 rounded-lg bg-primary text-primary-foreground font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                  {room.number}
                                </div>
                                <div className="truncate min-w-0">
                                  <div className="font-bold text-xs text-foreground truncate">
                                    Room {room.number}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground truncate">
                                    {room.typeName}
                                  </div>
                                </div>
                              </div>

                              {/* Editable Nightly Rate & Remove */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="inline-flex items-center h-8.5 rounded-lg border border-input bg-background px-2 shadow-2xs focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
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
                                    title="Edit Nightly Tariff (₹)"
                                  />
                                  <span className="text-[10px] text-muted-foreground select-none ml-0.5">
                                    /nt
                                  </span>
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveRoom(room.id)}
                                  className="size-8.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0 rounded-lg"
                                  title={`Remove Room ${room.number}`}
                                >
                                  <DeleteIcon className="size-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Live Tariff Subtotal Banner */}
                      <div className="px-3.5 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs flex flex-wrap items-center justify-between gap-2 text-primary">
                        <span className="font-medium">
                          Nightly Tariff ({selectedRooms.length}{" "}
                          {selectedRooms.length === 1 ? "room" : "rooms"} × {stayDays}{" "}
                          {stayDays === 1 ? "night" : "nights"}):
                        </span>
                        <div className="font-mono font-bold text-sm">
                          {formatINR(totalRoomTariffPerNight)}/nt{" "}
                          <span className="text-xs font-normal text-primary/80">
                            ({formatINR(roomCharges)} total)
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* ─── Card 3: Guest & Visit Information ─── */}
              <section className="rounded-xl border border-border bg-card p-3.5 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                      <GuestIcon className="size-3.5" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-foreground tracking-tight">
                      Guest Profile & Visit Details
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-[11px]">
                    {1 + accompanyingGuests.length}{" "}
                    {1 + accompanyingGuests.length === 1 ? "Guest" : "Guests"}
                  </Badge>
                </div>

                {/* Primary Guest Block (Responsive 12-Col Grid) */}
                <div className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground tracking-wide flex items-center gap-1.5">
                      Primary Guest
                    </span>
                    <Badge variant="default" className="text-[10px] h-4.5 px-2">
                      Lead Guest
                    </Badge>
                  </div>

                  <div className="grid grid-cols-12 gap-3">
                    {/* Full Name: 12 cols on mobile, 6 on sm+ */}
                    <div className="col-span-12 sm:col-span-6 space-y-1">
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
                          "h-10 sm:h-9 text-xs bg-background",
                          errors.primaryName &&
                          "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {errors.primaryName && (
                        <p className="text-[11px] text-destructive font-medium">
                          {errors.primaryName}
                        </p>
                      )}
                    </div>

                    {/* Mobile Number: 12 cols on mobile, 6 on sm+ */}
                    <div className="col-span-12 sm:col-span-6 space-y-1">
                      <Label htmlFor="primaryMobile" className="text-xs font-medium">
                        Mobile Number <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="primaryMobile"
                        type="tel"
                        inputMode="tel"
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
                          "h-10 sm:h-9 text-xs bg-background font-mono",
                          errors.primaryMobile &&
                          "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {errors.primaryMobile && (
                        <p className="text-[11px] text-destructive font-medium">
                          {errors.primaryMobile}
                        </p>
                      )}
                    </div>

                    {/* Age: 4 cols on mobile, 3 on sm+ */}
                    <div className="col-span-4 sm:col-span-3 space-y-1">
                      <Label htmlFor="primaryAge" className="text-xs font-medium">
                        Age <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="primaryAge"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={125}
                        placeholder="32"
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
                          "h-10 sm:h-9 text-xs bg-background font-mono",
                          errors.primaryAge &&
                          "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {errors.primaryAge && (
                        <p className="text-[11px] text-destructive font-medium">
                          {errors.primaryAge}
                        </p>
                      )}
                    </div>

                    {/* Sex: 8 cols on mobile, 3 on sm+ */}
                    <div className="col-span-8 sm:col-span-3 space-y-1">
                      <Label htmlFor="primarySex" className="text-xs font-medium">
                        Gender
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
                        className="h-10 sm:h-9"
                      />
                    </div>

                    {/* Father's Name: 12 cols on mobile, 6 on sm+ */}
                    <div className="col-span-12 sm:col-span-6 space-y-1">
                      <Label
                        htmlFor="primaryFatherName"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Father&apos;s / Guardian Name (Optional)
                      </Label>
                      <Input
                        id="primaryFatherName"
                        placeholder="Optional for register"
                        value={primaryGuest.fatherName}
                        onChange={(e) =>
                          setPrimaryGuest((prev) => ({
                            ...prev,
                            fatherName: e.target.value,
                          }))
                        }
                        className="h-10 sm:h-9 text-xs bg-background"
                      />
                    </div>
                  </div>
                </div>

                {/* Accompanying Guests List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
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
                      className="h-8 text-xs gap-1.5 cursor-pointer border-primary/30 text-primary hover:bg-primary/5"
                    >
                      <AddIcon className="size-3.5" />
                      <span>Add Guest</span>
                    </Button>
                  </div>

                  {accompanyingGuests.map((guest, idx) => {
                    const gErr = accompanyingErrors[guest.id] || {};
                    return (
                      <div
                        key={guest.id}
                        className="p-3.5 rounded-xl border border-border/70 bg-muted/10 space-y-3 relative transition-all"
                      >
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <span className="size-5 rounded-full bg-muted text-muted-foreground text-[10px] flex items-center justify-center font-mono">
                              #{idx + 2}
                            </span>
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
                            className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                            title="Remove guest"
                          >
                            <DeleteIcon className="size-3.5" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-12 gap-3">
                          {/* Guest Name */}
                          <div className="col-span-12 sm:col-span-6 space-y-1">
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
                                    if (copy[guest.id]) delete copy[guest.id].name;
                                    return copy;
                                  });
                                }
                              }}
                              className={cn(
                                "h-10 sm:h-9 text-xs bg-background",
                                gErr.name &&
                                "border-destructive focus-visible:ring-destructive"
                              )}
                            />
                            {gErr.name && (
                              <p className="text-[11px] text-destructive font-medium">
                                {gErr.name}
                              </p>
                            )}
                          </div>

                          {/* Guest Mobile */}
                          <div className="col-span-12 sm:col-span-6 space-y-1">
                            <Label className="text-xs font-medium">
                              Mobile Number <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              type="tel"
                              inputMode="tel"
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
                                    if (copy[guest.id]) delete copy[guest.id].mobile;
                                    return copy;
                                  });
                                }
                              }}
                              className={cn(
                                "h-10 sm:h-9 text-xs bg-background font-mono",
                                gErr.mobile &&
                                "border-destructive focus-visible:ring-destructive"
                              )}
                            />
                            {gErr.mobile && (
                              <p className="text-[11px] text-destructive font-medium">
                                {gErr.mobile}
                              </p>
                            )}
                          </div>

                          {/* Guest Age */}
                          <div className="col-span-4 sm:col-span-3 space-y-1">
                            <Label className="text-xs font-medium">
                              Age <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={125}
                              placeholder="28"
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
                                    if (copy[guest.id]) delete copy[guest.id].age;
                                    return copy;
                                  });
                                }
                              }}
                              className={cn(
                                "h-10 sm:h-9 text-xs bg-background font-mono",
                                gErr.age &&
                                "border-destructive focus-visible:ring-destructive"
                              )}
                            />
                            {gErr.age && (
                              <p className="text-[11px] text-destructive font-medium">
                                {gErr.age}
                              </p>
                            )}
                          </div>

                          {/* Guest Sex */}
                          <div className="col-span-8 sm:col-span-3 space-y-1">
                            <Label className="text-xs font-medium">
                              Gender <span className="text-destructive">*</span>
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
                              className="h-10 sm:h-9"
                            />
                            {gErr.sex && (
                              <p className="text-[11px] text-destructive font-medium">
                                {gErr.sex}
                              </p>
                            )}
                          </div>

                          {/* Guest Father's Name */}
                          <div className="col-span-12 sm:col-span-6 space-y-1">
                            <Label className="text-xs font-medium text-muted-foreground">
                              Father&apos;s Name (Optional)
                            </Label>
                            <Input
                              placeholder="Optional"
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
                              className="h-10 sm:h-9 text-xs bg-background"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Visit Context (Source, Origin, Purpose) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/60">
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
                      className="h-10 sm:h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="modalArrivingFrom" className="text-xs font-medium">
                      Arriving From <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="modalArrivingFrom"
                      placeholder="e.g. Kolkata, Delhi"
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
                        "h-10 sm:h-9 text-xs bg-background",
                        errors.arrivingFrom &&
                        "border-destructive focus-visible:ring-destructive"
                      )}
                    />
                    {errors.arrivingFrom && (
                      <p className="text-[11px] text-destructive font-medium">
                        {errors.arrivingFrom}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="modalPurpose" className="text-xs font-medium">
                      Purpose of Visit <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="modalPurpose"
                      placeholder="e.g. Business, Leisure"
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
                        "h-10 sm:h-9 text-xs bg-background",
                        errors.purposeOfVisit &&
                        "border-destructive focus-visible:ring-destructive"
                      )}
                    />
                    {errors.purposeOfVisit && (
                      <p className="text-[11px] text-destructive font-medium">
                        {errors.purposeOfVisit}
                      </p>
                    )}
                  </div>
                </div>

                {/* Touch-Friendly Corporate / B2B GST Toggle Card */}
                <div className="pt-2 border-t border-border/60 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowCorporate((prev) => !prev)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer",
                      showCorporate
                        ? "bg-primary/5 border-primary/30"
                        : "bg-muted/20 border-border/70 hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "size-7 rounded-lg flex items-center justify-center transition-colors",
                          showCorporate
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <BuildingIcon className="size-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          Corporate / Business Billing (GST Invoice)
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Add company name & GSTIN for B2B tax credit
                        </div>
                      </div>
                    </div>

                    {/* Visual Switch Pill */}
                    <div
                      className={cn(
                        "w-9 h-5 rounded-full p-0.5 transition-colors shrink-0",
                        showCorporate ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    >
                      <div
                        className={cn(
                          "size-4 rounded-full bg-white shadow-xs transition-transform",
                          showCorporate ? "translate-x-4" : "translate-x-0"
                        )}
                      />
                    </div>
                  </button>

                  {showCorporate && (
                    <div className="p-3.5 rounded-xl border border-primary/20 bg-muted/15 space-y-3">
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
                            className="h-10 sm:h-9 text-xs bg-background"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="companyGstin" className="text-xs font-medium">
                            Company GSTIN
                          </Label>
                          <Input
                            id="companyGstin"
                            placeholder="19AAAAA0000A1Z5"
                            value={companyGstin}
                            onChange={(e) => {
                              setCompanyGstin(e.target.value.toUpperCase());
                              if (errors.companyGstin) {
                                setErrors((prev) => {
                                  const copy = { ...prev };
                                  delete copy.companyGstin;
                                  return copy;
                                });
                              }
                            }}
                            className={cn(
                              "h-10 sm:h-9 text-xs bg-background font-mono uppercase",
                              errors.companyGstin && "border-destructive"
                            )}
                            maxLength={15}
                          />
                          {errors.companyGstin && (
                            <p className="text-[11px] text-destructive font-medium">
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
                          placeholder="Full billing address for invoice"
                          value={companyAddress}
                          onChange={(e) => setCompanyAddress(e.target.value)}
                          className="h-10 sm:h-9 text-xs bg-background"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ═══════════════ STEP 2: REVIEW & PAYMENT ═══════════════ */}
          {step === "PAYMENT" && (
            <div className="space-y-4 sm:space-y-5">
              {/* Compact Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                {/* Stay & Room Summary */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="size-4 text-primary" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Stay & Rooms
                      </h4>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {stayDays} {stayDays === 1 ? "Night" : "Nights"}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Check-In:</span>
                      <span className="font-semibold text-foreground font-mono text-right">
                        {formatIST(fromISTInput(checkInStr), "dd/MM/yyyy, hh:mm a")}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Check-Out:</span>
                      <span className="font-semibold text-foreground font-mono text-right">
                        {formatIST(fromISTInput(checkOutStr), "dd/MM/yyyy, hh:mm a")}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-border/60">
                      <div className="flex flex-wrap gap-1.5">
                        {selectedRooms.map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-bold"
                          >
                            Rm {r.number} • {r.typeName}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Guest Summary */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <GuestIcon className="size-4 text-primary" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Guest Details
                      </h4>
                    </div>
                    <Badge variant="secondary" className="text-[11px]">
                      {bookingSource.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Primary:</span>
                      <span className="font-bold text-foreground text-right truncate">
                        {primaryGuest.name} ({primaryGuest.age}y, {primaryGuest.sex})
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Mobile:</span>
                      <span className="font-mono text-foreground">
                        {primaryGuest.mobile}
                      </span>
                    </div>
                    {accompanyingGuests.length > 0 && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">With:</span>
                        <span className="font-medium text-foreground text-right truncate">
                          {accompanyingGuests.map((g) => g.name || "Guest").join(", ")}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2 pt-1.5 border-t border-border/60">
                      <span className="text-muted-foreground shrink-0">Route / Purpose:</span>
                      <span className="font-medium text-foreground text-right truncate">
                        {arrivingFrom} • {purposeOfVisit}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Folio Breakdown & Advance Settlement Card */}
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                      <RupeeIcon className="size-3.5" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-foreground tracking-tight">
                      Folio Breakdown & Advance Settlement
                    </h3>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    GST Slab: {gstPercent}%
                  </Badge>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Room Tariff ({stayDays} {stayDays === 1 ? "night" : "nights"} ×{" "}
                      {formatINR(totalRoomTariffPerNight)})
                    </span>
                    <span className="font-mono font-semibold text-foreground text-sm">
                      {formatINR(roomCharges)}
                    </span>
                  </div>

                  {/* Discount Row */}
                  <div className="flex justify-between items-center">
                    <Label htmlFor="discountInput" className="text-xs text-muted-foreground font-normal">
                      Promotional / Desk Discount (₹)
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground font-mono">- ₹</span>
                      <Input
                        id="discountInput"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={roomCharges}
                        value={discountStr}
                        onChange={(e) => setDiscountStr(e.target.value)}
                        className="w-24 sm:w-28 h-9 text-xs font-mono text-right bg-background"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-border">
                    <span className="text-muted-foreground font-medium">Taxable Amount</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatINR(taxableAmount)}
                    </span>
                  </div>

                  {/* GST Split */}
                  <div className="pl-3 border-l-2 border-primary/30 space-y-1 text-[11px] text-muted-foreground">
                    <div className="flex justify-between">
                      <span>CGST ({gstPercent / 2}%)</span>
                      <span className="font-mono">{formatINR(cgstAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST ({gstPercent / 2}%)</span>
                      <span className="font-mono">{formatINR(sgstAmount)}</span>
                    </div>
                  </div>

                  {/* Grand Total Banner */}
                  <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5 border border-primary/20 font-bold text-sm">
                    <span className="text-foreground">Grand Total (Incl. GST)</span>
                    <span className="font-mono text-primary text-base sm:text-lg">
                      {formatINR(totalBill)}
                    </span>
                  </div>

                  {/* Advance Collection Box with Quick-Fill Presets */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-muted/30 border border-border space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                      <div className="space-y-1">
                        <span className="font-bold text-foreground text-xs block">
                          Advance Collected Now (₹)
                        </span>
                        {/* Quick Preset Pills */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setAdvanceAmountStr(String(totalBill))}
                            className="px-2 py-0.5 rounded bg-background border border-border text-[10px] font-semibold hover:border-primary hover:text-primary transition-colors cursor-pointer"
                          >
                            100% ({formatINR(totalBill)})
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAdvanceAmountStr(String(Math.round(totalBill / 2)))
                            }
                            className="px-2 py-0.5 rounded bg-background border border-border text-[10px] font-semibold hover:border-primary hover:text-primary transition-colors cursor-pointer"
                          >
                            50% ({formatINR(Math.round(totalBill / 2))})
                          </button>
                          {advanceAmount > 0 && (
                            <button
                              type="button"
                              onClick={() => setAdvanceAmountStr("")}
                              className="px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <span className="text-muted-foreground font-mono text-sm font-semibold">
                          ₹
                        </span>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={totalBill}
                          placeholder="0"
                          value={advanceAmountStr}
                          onChange={(e) => setAdvanceAmountStr(e.target.value)}
                          className="w-32 sm:w-36 h-10 sm:h-9 text-sm font-mono font-bold text-right bg-background"
                        />
                      </div>
                    </div>

                    {/* One-Tap Payment Mode Pills */}
                    {advanceAmount > 0 && (
                      <div className="pt-3 border-t border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-muted-foreground font-medium text-xs">
                          Payment Mode:
                        </span>
                        <div className="grid grid-cols-2 sm:flex items-center gap-1.5">
                          {(
                            [
                              { label: "Cash", value: "CASH" },
                              { label: "UPI / QR", value: "UPI" },
                              { label: "Card", value: "CARD" },
                              { label: "Bank Transfer", value: "BANK_TRANSFER" },
                            ] as const
                          ).map((mode) => (
                            <button
                              key={mode.value}
                              type="button"
                              onClick={() => setAdvanceMode(mode.value)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center",
                                advanceMode === mode.value
                                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                                  : "bg-background text-muted-foreground border-border hover:text-foreground"
                              )}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Balance Due Row */}
                  <div className="flex justify-between items-center pt-1 font-bold text-sm">
                    <span className="text-foreground">Net Balance Payable:</span>
                    <span
                      className={cn(
                        "font-mono text-base sm:text-lg",
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
            <div className="py-4 sm:py-6 space-y-5 max-w-lg mx-auto text-center">
              <div className="size-16 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-xs">
                <CheckIcon className="size-8 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {createdBooking.status === "CHECKED_IN"
                    ? "Guest Checked In!"
                    : "Reservation Confirmed!"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {createdBooking.status === "CHECKED_IN"
                    ? "Room keys can now be handed over. Stay folio is active."
                    : "Rooms have been blocked for the scheduled arrival window."}
                </p>
              </div>

              {/* Receipt-Style Confirmation Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border space-y-3 text-xs text-left shadow-xs">
                <div className="flex justify-between items-center pb-2.5 border-b border-border/70">
                  <span className="text-muted-foreground">Booking Reference</span>
                  <Badge variant="default" className="font-mono text-xs px-2.5 py-0.5">
                    {createdBooking.reference}
                  </Badge>
                </div>

                <div className="flex justify-between items-start gap-3">
                  <span className="text-muted-foreground shrink-0">Assigned Room(s)</span>
                  <span className="font-bold text-foreground text-right">
                    Room {createdBooking.roomNumber} ({createdBooking.roomTypeName})
                  </span>
                </div>

                <div className="flex justify-between items-start gap-3">
                  <span className="text-muted-foreground shrink-0">Stay Window</span>
                  <span className="font-mono text-[11px] text-foreground text-right">
                    {createdBooking.checkInFormatted} &rarr;{" "}
                    {createdBooking.checkOutFormatted}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Primary Guest</span>
                  <span className="font-semibold text-foreground">
                    {createdBooking.primaryGuestName}
                  </span>
                </div>

                {createdBooking.accompanyingGuestNames &&
                  createdBooking.accompanyingGuestNames.length > 0 && (
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-muted-foreground shrink-0">
                        Accompanying
                      </span>
                      <span className="font-medium text-foreground text-right">
                        {createdBooking.accompanyingGuestNames.join(", ")}
                      </span>
                    </div>
                  )}

                <div className="pt-2.5 border-t border-dashed border-border space-y-1.5">
                  {createdBooking.advancePaid > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                      <span>Advance Paid</span>
                      <span className="font-mono font-bold">
                        {formatINR(createdBooking.advancePaid)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-sm font-bold">
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
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
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
                  <span>Create Another Booking</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ───────── Sticky Bottom Action Bar ───────── */}
        {step !== "CONFIRMATION" && (
          <div className="px-3.5 py-3 sm:px-6 sm:py-4 border-t border-border bg-card/95 backdrop-blur-xs flex items-center justify-between gap-2 shrink-0 sticky bottom-0 z-10 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-4 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
            {step === "INFO" ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleModalClose(false)}
                  className="text-xs cursor-pointer h-10 sm:h-9 px-3"
                >
                  Cancel
                </Button>

                <div className="flex items-center gap-3">
                  {selectedRooms.length > 0 && (
                    <div className="hidden sm:flex flex-col items-end text-right">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Est. Room Charges ({stayDays}N)
                      </span>
                      <span className="text-xs font-mono font-bold text-foreground">
                        {formatINR(roomCharges)} + GST
                      </span>
                    </div>
                  )}

                  <Button
                    type="button"
                    onClick={handleProceedToPayment}
                    className="gap-1.5 text-xs font-semibold shadow-xs cursor-pointer h-10 sm:h-9 px-4"
                  >
                    <span>Review & Payment</span>
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep("INFO")}
                  disabled={isSubmitting}
                  className="gap-1 text-xs cursor-pointer shrink-0 h-10 sm:h-9 px-2.5 sm:px-3"
                >
                  <ChevronLeftIcon className="size-4" />
                  <span className="hidden sm:inline">Edit Details</span>
                  <span className="sm:hidden">Back</span>
                </Button>

                <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => handleSubmitBooking("RESERVE")}
                    className="flex-1 sm:flex-initial gap-1.5 text-xs font-semibold border-status-reserved/40 text-status-reserved hover:bg-status-reserved/10 cursor-pointer h-10 sm:h-9 px-3"
                  >
                    {isSubmitting ? (
                      <SpinnerIcon className="size-3.5 animate-spin" />
                    ) : (
                      <CalendarIcon className="size-3.5 shrink-0" />
                    )}
                    <span className="hidden sm:inline">Save Reservation</span>
                    <span className="sm:hidden">Reserve</span>
                  </Button>

                  <Button
                    type="button"
                    variant="default"
                    disabled={isSubmitting}
                    onClick={() => handleSubmitBooking("CHECK_IN")}
                    className="flex-1 sm:flex-initial gap-1.5 text-xs font-semibold shadow-xs cursor-pointer h-10 sm:h-9 px-3.5"
                  >
                    {isSubmitting ? (
                      <SpinnerIcon className="size-3.5 animate-spin" />
                    ) : (
                      <CheckInIcon className="size-3.5 shrink-0" />
                    )}
                    <span>Check In Now</span>
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