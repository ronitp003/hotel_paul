"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatIST, formatISTDateTime, fromISTInput, toISTInputString } from "@/lib/datetime";
import { formatINR } from "@/lib/money";
import { createBookingAction } from "@/server/actions/booking.actions";
import { findAvailableRoomsAction } from "@/server/actions/room.actions";
import type { AvailableRoomResult } from "@/server/services/room.service";
import { calculateStay, type StayCalculationResult } from "@/lib/stay";
import {
  CalendarIcon,
  CheckInIcon,
  RoomIcon,
  GuestIcon,
  RupeeIcon,
  AddIcon,
  DeleteIcon,
  ChevronRightIcon,
  CheckIcon,
  ClockIcon,
  SpinnerIcon,
  ProblemIcon,
  InfoIcon,
  SearchIcon,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface GuestState {
  id: string;
  name: string;
  fatherName: string;
  age: string;
  sex: "MALE" | "FEMALE" | "OTHER";
  mobile: string;
  isPrimary: boolean;
}

interface NewBookingFlowProps {
  roomTypes: Array<{ id: string; name: string }>;
  initialRooms?: AvailableRoomResult[];
  preselectedRoomId?: string;
  graceMinutes?: number;
}

export function NewBookingFlow({
  roomTypes,
  initialRooms = [],
  preselectedRoomId,
  graceMinutes = 0,
}: NewBookingFlowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSearchingRooms, setIsSearchingRooms] = useState(false);

  // Stepper state: 1 = Dates, 2 = Room, 3 = Guests, 4 = Payment & Review
  const [currentStep, setCurrentStep] = useState<number>(preselectedRoomId ? 2 : 1);

  // ───────── Step 1: Dates & Duration ─────────
  const defaultCheckIn = new Date();
  const defaultCheckOut = new Date(defaultCheckIn.getTime() + 24 * 60 * 60 * 1000);

  const [checkInStr, setCheckInStr] = useState<string>(() => toISTInputString(defaultCheckIn));
  const [checkOutStr, setCheckOutStr] = useState<string>(() => toISTInputString(defaultCheckOut));

  // Calculated stay days
  const currentStay: StayCalculationResult = (() => {
    try {
      const start = fromISTInput(checkInStr);
      const end = fromISTInput(checkOutStr);
      if (end.getTime() > start.getTime()) {
        return calculateStay(start, end, graceMinutes);
      }
    } catch {
      // fallback
    }
    return {
      days: 1,
      hours: 24,
      minutes: 1440,
      elapsedMs: 86400000,
      graceMinutes,
      isGracePeriodApplied: false,
    };
  })();

  // ───────── Step 2: Available Rooms ─────────
  const [rooms, setRooms] = useState<AvailableRoomResult[]>(initialRooms);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(preselectedRoomId || "");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [searchFilter, setSearchFilter] = useState<string>("");

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  // ───────── Step 3: Guests & Visit ─────────
  const [guests, setGuests] = useState<GuestState[]>([
    {
      id: "guest-primary",
      name: "",
      fatherName: "",
      age: "",
      sex: "MALE",
      mobile: "",
      isPrimary: true,
    },
  ]);

  const [bookingSource, setBookingSource] = useState<
    "WALK_IN" | "PHONE" | "ONLINE" | "CORPORATE" | "OTHER"
  >("WALK_IN");
  const [arrivingFrom, setArrivingFrom] = useState("");
  const [purposeOfVisit, setPurposeOfVisit] = useState("");

  const [showCorporate, setShowCorporate] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");

  // ───────── Step 4: Financials ─────────
  const [customRate, setCustomRate] = useState<string>("");
  const [discountStr, setDiscountStr] = useState<string>("0");
  const [advanceAmountStr, setAdvanceAmountStr] = useState<string>("0");
  const [advanceMode, setAdvanceMode] = useState<"CASH" | "UPI" | "CARD" | "BANK_TRANSFER">("CASH");

  // Effective rate applied
  const effectiveRate =
    customRate !== "" && !isNaN(Number(customRate))
      ? Number(customRate)
      : selectedRoom?.pricePerNight ?? 0;

  const discount = Math.max(0, Number(discountStr) || 0);
  const advanceAmount = Math.max(0, Number(advanceAmountStr) || 0);

  // Live bill calculation
  const roomCharges = effectiveRate * currentStay.days;
  const taxableAmount = Math.max(0, roomCharges - discount);
  // GST Slab: 5% up to ₹7,500/night; 18% above
  const gstPercent = effectiveRate > 7500 ? 18 : 5;
  const cgstAmount = Math.round(((taxableAmount * gstPercent) / 200) * 100) / 100;
  const sgstAmount = cgstAmount;
  const totalBill = Math.round(taxableAmount + cgstAmount + sgstAmount);
  const balanceDue = Math.max(0, totalBill - advanceAmount);

  // ───────── Success Confirmation Dialog ─────────
  const [createdBooking, setCreatedBooking] = useState<{
    reference: string;
    status: string;
    roomNumber: string;
    roomTypeName: string;
    primaryGuestName: string;
    advancePaid: number;
    balanceDue: number;
  } | null>(null);

  // Refresh available rooms when dates change or user triggers
  const handleQueryRooms = async () => {
    try {
      setIsSearchingRooms(true);
      const start = fromISTInput(checkInStr);
      const end = fromISTInput(checkOutStr);

      if (end.getTime() <= start.getTime()) {
        toast.error("Check-out time must be strictly after check-in time.");
        return;
      }

      const res = await findAvailableRoomsAction(start.toISOString(), end.toISOString());
      if (res.ok && res.data) {
        setRooms(res.data.rooms);
        // If selected room is no longer available in the new window, reset it
        const stillAvail = res.data.rooms.find((r) => r.id === selectedRoomId && r.isAvailable);
        if (!stillAvail) {
          setSelectedRoomId("");
        }
        setCurrentStep(2);
      } else {
        toast.error(res.message || "Failed to check room availability.");
      }
    } catch {
      toast.error("An error occurred while finding available rooms.");
    } finally {
      setIsSearchingRooms(false);
    }
  };

  // Preset dates helper
  const handleApplyPreset = (hoursOffset: number) => {
    const start = new Date();
    start.setMinutes(0, 0, 0); // clean hour
    const end = new Date(start.getTime() + hoursOffset * 60 * 60 * 1000);
    setCheckInStr(toISTInputString(start));
    setCheckOutStr(toISTInputString(end));
  };

  // Guest repeater helpers
  const handleAddGuest = () => {
    setGuests((prev) => [
      ...prev,
      {
        id: `guest-${Date.now()}`,
        name: "",
        fatherName: "",
        age: "",
        sex: "MALE",
        mobile: "",
        isPrimary: false,
      },
    ]);
  };

  const handleRemoveGuest = (index: number) => {
    setGuests((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateGuest = (index: number, field: keyof GuestState, value: unknown) => {
    setGuests((prev) =>
      prev.map((g, i) => (i === index ? { ...g, [field]: value } : g))
    );
  };

  // Submit Booking / Check-in
  const handleSubmitBooking = async (action: "RESERVE" | "CHECK_IN") => {
    if (!selectedRoomId) {
      toast.error("Please select a room first.");
      setCurrentStep(2);
      return;
    }

    const primary = guests.find((g) => g.isPrimary);
    if (!primary || !primary.name.trim()) {
      toast.error("Please enter the primary guest's full name.");
      setCurrentStep(3);
      return;
    }

    if (advanceAmount > 0 && !advanceMode) {
      toast.error("Please select a payment mode for the advance payment.");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          roomId: selectedRoomId,
          checkInAt: fromISTInput(checkInStr).toISOString(),
          checkOutAt: fromISTInput(checkOutStr).toISOString(),
          action,
          source: bookingSource,
          rateApplied: effectiveRate,
          discount,
          advanceAmount,
          advanceMode: advanceAmount > 0 ? advanceMode : null,
          arrivingFrom: arrivingFrom.trim(),
          purposeOfVisit: purposeOfVisit.trim(),
          companyName: companyName.trim(),
          companyGstin: companyGstin.trim(),
          companyAddress: companyAddress.trim(),
          guests: guests.map((g) => ({
            name: g.name.trim(),
            fatherName: g.fatherName.trim() || undefined,
            age: g.age ? parseInt(g.age, 10) : undefined,
            sex: g.sex,
            mobile: g.mobile.trim() || undefined,
            isPrimary: g.isPrimary,
          })),
        };

        const res = await createBookingAction(payload);
        if (res.ok && res.data) {
          toast.success(
            action === "CHECK_IN"
              ? `Guest checked in! Reference: ${res.data.reference}`
              : `Reservation confirmed! Reference: ${res.data.reference}`
          );

          setCreatedBooking({
            reference: res.data.reference,
            status: res.data.status,
            roomNumber: res.data.roomNumber,
            roomTypeName: res.data.roomTypeName,
            primaryGuestName: res.data.primaryGuestName,
            advancePaid: res.data.advancePaid,
            balanceDue: res.data.balanceDue,
          });
        } else {
          toast.error(res.message || "Failed to create booking.");
        }
      } catch {
        toast.error("A network or server error occurred. Please try again.");
      }
    });
  };

  // Filtered rooms
  const filteredRooms = rooms.filter((r) => {
    if (typeFilter !== "ALL" && r.typeId !== typeFilter) return false;
    if (searchFilter && !r.number.toLowerCase().includes(searchFilter.toLowerCase().trim())) {
      return false;
    }
    return true;
  });

  const availableCount = filteredRooms.filter((r) => r.isAvailable).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* ───────── Flow Header / Stepper Progress ───────── */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CalendarIcon className="size-6 text-primary" aria-hidden="true" />
              New Booking & Front Desk Check-in
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Select stay window, pick an available room, register guest particulars, and collect advance.
            </p>
          </div>
          {selectedRoom && (
            <Badge variant="outline" className="self-start sm:self-auto bg-primary/10 text-primary border-primary/20 text-xs py-1 px-3">
              Room {selectedRoom.number} Selected ({selectedRoom.typeName})
            </Badge>
          )}
        </div>

        {/* Step Indicator Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {[
            { step: 1, title: "Stay Dates" },
            { step: 2, title: "Choose Room" },
            { step: 3, title: "Guest Details" },
            { step: 4, title: "Review & Payment" },
          ].map(({ step, title }) => {
            const isCompleted = currentStep > step;
            const isCurrent = currentStep === step;

            return (
              <button
                key={step}
                type="button"
                onClick={() => {
                  if (step < currentStep || (step === 2 && checkInStr && checkOutStr)) {
                    setCurrentStep(step);
                  }
                }}
                disabled={step > currentStep && (step !== 2 || !selectedRoomId)}
                className={cn(
                  "flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all",
                  isCurrent
                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                    : isCompleted
                      ? "bg-muted/60 text-foreground border-border hover:bg-muted cursor-pointer"
                      : "bg-muted/20 text-muted-foreground border-transparent cursor-not-allowed opacity-60"
                )}
              >
                <div
                  className={cn(
                    "size-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                    isCurrent
                      ? "bg-primary-foreground text-primary"
                      : isCompleted
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <CheckIcon className="size-3.5" /> : step}
                </div>
                <div className="truncate">
                  <span className="truncate block font-medium">{title}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ───────── STEP 1: Dates & Duration ───────── */}
      {currentStep === 1 && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ClockIcon className="size-5 text-primary" />
                Step 1: Stay Window & 24h Calculation
              </h2>
              <p className="text-xs text-muted-foreground">
                Set guest arrival and planned departure times. All stays are billed on 24-hour cycles.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="checkin-input" className="text-sm font-medium">
                Check-in Date & Time (IST) *
              </Label>
              <Input
                id="checkin-input"
                type="datetime-local"
                value={checkInStr}
                onChange={(e) => setCheckInStr(e.target.value)}
                className="font-mono text-sm h-11"
              />
              <span className="text-xs text-muted-foreground">
                {checkInStr ? formatISTDateTime(fromISTInput(checkInStr)) : ""}
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkout-input" className="text-sm font-medium">
                Check-out Date & Time (IST) *
              </Label>
              <Input
                id="checkout-input"
                type="datetime-local"
                value={checkOutStr}
                onChange={(e) => setCheckOutStr(e.target.value)}
                className="font-mono text-sm h-11"
              />
              <span className="text-xs text-muted-foreground">
                {checkOutStr ? formatISTDateTime(fromISTInput(checkOutStr)) : ""}
              </span>
            </div>
          </div>

          {/* Quick presets */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Stay Presets
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset(24)}
                className="text-xs"
              >
                1 Night (24 Hours)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset(48)}
                className="text-xs"
              >
                2 Nights (48 Hours)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset(72)}
                className="text-xs"
              >
                3 Nights (72 Hours)
              </Button>
            </div>
          </div>

          {/* Live Stay Calculation Preview */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  Billed Stay Duration:
                </span>
                <Badge className="bg-primary text-primary-foreground text-sm font-bold px-2.5 py-0.5">
                  {currentStay.days} {currentStay.days === 1 ? "Day" : "Days"}
                </Badge>
                {currentStay.isGracePeriodApplied && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">
                    Grace Absorbed ({graceMinutes}m)
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Total elapsed: {currentStay.hours} hours ({currentStay.minutes} minutes). Grace period: {graceMinutes} mins.
              </p>
            </div>

            <Button
              type="button"
              onClick={handleQueryRooms}
              disabled={isSearchingRooms}
              className="w-full sm:w-auto h-11 px-6 font-semibold"
            >
              {isSearchingRooms ? (
                <>
                  <SpinnerIcon className="size-4 animate-spin mr-2" />
                  Checking Availability...
                </>
              ) : (
                <>
                  Find Available Rooms
                  <ChevronRightIcon className="size-4 ml-1.5" />
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* ───────── STEP 2: Choose Room ───────── */}
      {currentStep === 2 && (
        <Card className="p-6 space-y-6 overflow-visible relative">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <RoomIcon className="size-5 text-primary" />
                Step 2: Select an Available Room
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Window: {formatIST(fromISTInput(checkInStr), "d MMM, h:mm a")} →{" "}
                {formatIST(fromISTInput(checkOutStr), "d MMM, h:mm a")} ({currentStay.days} {currentStay.days === 1 ? "day" : "days"})
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(1)}
              className="text-xs self-start sm:self-auto h-8 px-3"
            >
              Change Dates
            </Button>
          </div>

          {/* Filters Row: Room Number Search + Room Type Dropdown + Availability Counts */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-3 rounded-lg border border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
              {/* Room Number Search */}
              <div className="relative flex-1 sm:max-w-xs">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search room number..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-9 h-9 text-sm bg-background"
                />
              </div>

              {/* Room Type Dropdown */}
              <div className="w-full sm:w-56">
                <select
                  id="room-type-filter"
                  aria-label="Filter by Room Type"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground font-medium cursor-pointer"
                >
                  <option value="ALL">All Room Types ({rooms.length})</option>
                  {roomTypes.map((type) => {
                    const count = rooms.filter((r) => r.typeId === type.id).length;
                    return (
                      <option key={type.id} value={type.id}>
                        {type.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Availability Stats */}
            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs shrink-0 px-1">
              <span className="text-muted-foreground">
                Showing <strong className="text-foreground">{filteredRooms.length}</strong> of {rooms.length} rooms
              </span>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 font-semibold text-xs"
              >
                {availableCount} Available
              </Badge>
            </div>
          </div>

          {/* Rooms Grid with bottom clearance so room cards are never obscured by sticky footer */}
          <div className="space-y-3 pb-8">
            {filteredRooms.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-border text-muted-foreground space-y-2">
                <RoomIcon className="size-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-medium">No rooms match your filter criteria.</p>
                <p className="text-xs text-muted-foreground">Try clearing your search or switching back to &ldquo;All Room Types&rdquo;.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRooms.map((room) => {
                  const isSelected = selectedRoomId === room.id;
                  const isAvail = room.isAvailable;

                  return (
                    <div
                      key={room.id}
                      onClick={() => {
                        if (isAvail) {
                          setSelectedRoomId(room.id);
                        }
                      }}
                      className={cn(
                        "relative flex flex-col justify-between p-4 rounded-xl border transition-all text-left",
                        isAvail
                          ? "cursor-pointer hover:border-primary/50 hover:shadow-xs bg-card"
                          : "opacity-60 bg-muted/40 cursor-not-allowed border-border/80",
                        isSelected && isAvail
                          ? "border-primary ring-2 ring-primary/25 bg-teal-50/70 dark:bg-teal-950/30 shadow-sm"
                          : ""
                      )}
                    >
                      <div className="space-y-2.5">
                        {/* Top info */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                              Room
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                                {room.number}
                              </span>
                              {isSelected && isAvail && (
                                <Badge className="bg-primary text-primary-foreground text-[10px] font-semibold py-0 px-1.5 h-4.5">
                                  Selected
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs font-semibold",
                                isAvail
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                                  : room.unavailableType === "RESERVED"
                                  ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                                  : "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900 dark:text-stone-300"
                              )}
                            >
                              {isAvail
                                ? "Available"
                                : room.unavailableType === "RESERVED"
                                ? "Reserved"
                                : room.unavailableType || "Unavailable"}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-medium">
                              {room.typeName}
                            </span>
                          </div>
                        </div>

                        {/* Pricing */}
                        <div className="pt-2 border-t border-border/60">
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold text-foreground">
                              {formatINR(room.pricePerNight)}
                            </span>
                            <span className="text-xs text-muted-foreground">/ night</span>
                          </div>
                          {isAvail && (
                            <span className="text-xs text-muted-foreground">
                              Estimated total:{" "}
                              <strong className="text-foreground">
                                {formatINR(room.pricePerNight * currentStay.days)}
                              </strong>{" "}
                              ({currentStay.days}d)
                            </span>
                          )}
                        </div>

                        {/* Open problem warning */}
                        {room.hasProblem && (
                          <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 p-1.5 rounded-md border border-amber-200 dark:border-amber-900">
                            <ProblemIcon className="size-3.5 shrink-0" />
                            <span>{room.openProblemsCount} open maintenance issue</span>
                          </div>
                        )}

                        {/* Unavailable reason message */}
                        {!isAvail && room.unavailableReason && (
                          <div
                            className={cn(
                              "text-xs p-2 rounded-md border font-medium",
                              room.unavailableType === "RESERVED"
                                ? "text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900"
                                : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900"
                            )}
                          >
                            {room.unavailableReason}
                          </div>
                        )}
                      </div>

                      {/* Selection button */}
                      <div className="pt-3 mt-3 border-t border-border/60">
                        {isAvail ? (
                          <Button
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            className={cn(
                              "w-full font-semibold text-xs h-8.5 transition-colors",
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "border-border hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                            )}
                          >
                            {isSelected ? (
                              <>
                                <CheckIcon className="size-3.5 mr-1.5" />
                                Selected
                              </>
                            ) : (
                              "Select Room"
                            )}
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground block text-center py-1">
                            Not Available
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ───────── STICKY BOOKING FOOTER ───────── */}
          <div className="sticky bottom-0 z-20 -mx-6 -mb-6 p-4 sm:px-6 sm:py-4 bg-card/95 backdrop-blur-md border-t border-border rounded-b-xl shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Left Action: Back to Dates (Desktop & Tablet) */}
              <div className="hidden sm:block">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="h-10 px-4 text-xs sm:text-sm font-medium border-border hover:bg-muted shrink-0"
                >
                  ← Back to Dates
                </Button>
              </div>

              {/* Center: Selected Room Summary & Live Price */}
              <div className="flex-1 sm:px-4">
                {selectedRoom && selectedRoom.isAvailable ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-center gap-2 sm:gap-6 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2.5">
                      <span className="inline-flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground font-mono font-bold text-sm shadow-xs">
                        {selectedRoom.number}
                      </span>
                      <div className="text-left">
                        <div className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                          <span>Room {selectedRoom.number}</span>
                          <span className="text-muted-foreground font-normal">•</span>
                          <span className="text-muted-foreground font-medium">{selectedRoom.typeName}</span>
                        </div>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Selected for check-in
                        </span>
                      </div>
                    </div>

                    <div className="hidden md:block h-8 w-px bg-border/80" />

                    <div className="flex items-center justify-center sm:justify-start gap-3 sm:gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Duration</span>
                        <strong className="text-foreground font-semibold">
                          {currentStay.days} {currentStay.days === 1 ? "Day" : "Days"}
                        </strong>
                      </div>
                      <div className="h-5 w-px bg-border/80" />
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Est. Total</span>
                        <span className="text-sm sm:text-base font-bold text-primary">
                          {formatINR(selectedRoom.pricePerNight * currentStay.days)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground text-xs sm:text-sm py-1">
                    <InfoIcon className="size-4 shrink-0 text-muted-foreground/80" />
                    <span>Please select an available room from the list to continue.</span>
                  </div>
                )}
              </div>

              {/* Action Buttons: Mobile & Desktop */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="sm:hidden flex-1 h-10 px-3 text-xs font-medium border-border"
                >
                  ← Dates
                </Button>

                <Button
                  type="button"
                  disabled={!selectedRoomId || !selectedRoom?.isAvailable}
                  onClick={() => {
                    if (selectedRoomId && selectedRoom?.isAvailable) {
                      setCurrentStep(3);
                    } else {
                      toast.error("Please select an available room to proceed.");
                    }
                  }}
                  className={cn(
                    "flex-1 sm:flex-initial h-10 px-5 sm:px-6 font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-1.5",
                    selectedRoomId && selectedRoom?.isAvailable
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "opacity-60 cursor-not-allowed"
                  )}
                >
                  <span>Next: Guest Information</span>
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ───────── STEP 3: Guest & Visit Details ───────── */}
      {currentStep === 3 && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <GuestIcon className="size-5 text-primary" />
                Step 3: Guest Registration & Visit Details
              </h2>
              <p className="text-xs text-muted-foreground">
                Enter primary guest particulars and add any accompanying occupants.
              </p>
            </div>
          </div>

          {/* Primary Guest Card */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <GuestIcon className="size-4" />
                Primary Guest *
              </span>
              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                Main Contact
              </Badge>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="primary-name" className="text-xs font-semibold">
                    Full Name *
                  </Label>
                  <Input
                    id="primary-name"
                    placeholder="e.g. Satyajit Ray"
                    value={guests[0].name}
                    onChange={(e) => handleUpdateGuest(0, "name", e.target.value)}
                    className="h-9"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="primary-phone" className="text-xs font-semibold">
                    Mobile Number
                  </Label>
                  <Input
                    id="primary-phone"
                    placeholder="10-digit mobile"
                    value={guests[0].mobile}
                    onChange={(e) => handleUpdateGuest(0, "mobile", e.target.value)}
                    className="h-9 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="primary-father" className="text-xs font-semibold">
                    Father / Husband Name
                  </Label>
                  <Input
                    id="primary-father"
                    placeholder="Father/Husband name"
                    value={guests[0].fatherName}
                    onChange={(e) => handleUpdateGuest(0, "fatherName", e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="primary-age" className="text-xs font-semibold">
                    Age
                  </Label>
                  <Input
                    id="primary-age"
                    type="number"
                    min={0}
                    max={120}
                    placeholder="Age"
                    value={guests[0].age}
                    onChange={(e) => handleUpdateGuest(0, "age", e.target.value)}
                    className="h-9 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="primary-sex" className="text-xs font-semibold">
                    Gender
                  </Label>
                  <select
                    id="primary-sex"
                    value={guests[0].sex}
                    onChange={(e) =>
                      handleUpdateGuest(0, "sex", e.target.value as "MALE" | "FEMALE" | "OTHER")
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Additional Guests */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Additional Occupants ({guests.length - 1})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddGuest}
                className="text-xs h-8"
              >
                <AddIcon className="size-3.5 mr-1" />
                Add Accompanying Guest
              </Button>
            </div>

            {guests.slice(1).map((guest, idx) => {
              const actualIdx = idx + 1;
              return (
                <div
                  key={guest.id}
                  className="p-4 rounded-xl border border-border bg-muted/20 space-y-3 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Guest #{actualIdx + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveGuest(actualIdx)}
                      className="text-destructive hover:bg-destructive/10 h-7 text-xs px-2"
                    >
                      <DeleteIcon className="size-3.5 mr-1" />
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Full Name</Label>
                      <Input
                        placeholder="Name"
                        value={guest.name}
                        onChange={(e) => handleUpdateGuest(actualIdx, "name", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Age</Label>
                      <Input
                        type="number"
                        placeholder="Age"
                        value={guest.age}
                        onChange={(e) => handleUpdateGuest(actualIdx, "age", e.target.value)}
                        className="h-8 text-sm font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Gender</Label>
                      <select
                        value={guest.sex}
                        onChange={(e) =>
                          handleUpdateGuest(
                            actualIdx,
                            "sex",
                            e.target.value as "MALE" | "FEMALE" | "OTHER"
                          )
                        }
                        className="flex h-8 w-full rounded-md border border-input bg-card px-2 py-1 text-xs shadow-xs"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Mobile (Optional)</Label>
                      <Input
                        placeholder="Mobile"
                        value={guest.mobile}
                        onChange={(e) => handleUpdateGuest(actualIdx, "mobile", e.target.value)}
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Visit Particulars */}
          <div className="space-y-3 pt-3 border-t border-border">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Visit Particulars
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="booking-source" className="text-xs font-semibold">
                  Booking Source
                </Label>
                <select
                  id="booking-source"
                  value={bookingSource}
                  onChange={(e) =>
                    setBookingSource(
                      e.target.value as "WALK_IN" | "PHONE" | "ONLINE" | "CORPORATE" | "OTHER"
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs"
                >
                  <option value="WALK_IN">Walk-in</option>
                  <option value="PHONE">Phone Reservation</option>
                  <option value="ONLINE">Online Portal</option>
                  <option value="CORPORATE">Corporate Tie-up</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="arriving-from" className="text-xs font-semibold">
                  Arriving From
                </Label>
                <Input
                  id="arriving-from"
                  placeholder="e.g. Kolkata, Asansol"
                  value={arrivingFrom}
                  onChange={(e) => setArrivingFrom(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="purpose-visit" className="text-xs font-semibold">
                  Purpose of Visit
                </Label>
                <Input
                  id="purpose-visit"
                  placeholder="e.g. Tourism / University"
                  value={purposeOfVisit}
                  onChange={(e) => setPurposeOfVisit(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* Collapsible Corporate / GSTIN Section */}
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowCorporate(!showCorporate)}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5"
            >
              <span>{showCorporate ? "− Hide" : "+ Add"} Corporate / GSTIN Billing Details</span>
            </button>

            {showCorporate && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3 p-4 rounded-xl bg-muted/30 border border-border">
                <div className="space-y-1.5">
                  <Label htmlFor="company-name" className="text-xs">
                    Company Name
                  </Label>
                  <Input
                    id="company-name"
                    placeholder="e.g. ABC Technologies Pvt Ltd"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-gstin" className="text-xs">
                    Company GSTIN
                  </Label>
                  <Input
                    id="company-gstin"
                    placeholder="15-character GSTIN"
                    value={companyGstin}
                    onChange={(e) => setCompanyGstin(e.target.value.toUpperCase())}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-addr" className="text-xs">
                    Company Address
                  </Label>
                  <Input
                    id="company-addr"
                    placeholder="City / Address"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(2)}
            >
              ← Back to Room
            </Button>

            <Button
              type="button"
              onClick={() => {
                if (!guests[0].name.trim()) {
                  toast.error("Please enter the primary guest's name.");
                  return;
                }
                setCurrentStep(4);
              }}
              className="h-10 px-6 font-semibold"
            >
              Next: Pricing & Payment
              <ChevronRightIcon className="size-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* ───────── STEP 4: Review, Pricing & Actions ───────── */}
      {currentStep === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Form controls */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 space-y-6">
              <div className="border-b border-border pb-3">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <RupeeIcon className="size-5 text-primary" />
                  Step 4: Pricing, Discount & Advance
                </h2>
                <p className="text-xs text-muted-foreground">
                  Review room tariff, apply any agreed discounts, and record advance payment.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rate-input" className="text-xs font-semibold">
                    Rate per Night (₹) *
                  </Label>
                  <Input
                    id="rate-input"
                    type="number"
                    min={0}
                    placeholder={String(selectedRoom?.pricePerNight ?? 0)}
                    value={customRate}
                    onChange={(e) => setCustomRate(e.target.value)}
                    className="h-10 font-mono text-base font-bold"
                  />
                  <span className="text-xs text-muted-foreground">
                    Standard tariff: {formatINR(selectedRoom?.pricePerNight ?? 0)}/night
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="discount-input" className="text-xs font-semibold">
                    Special Discount (₹)
                  </Label>
                  <Input
                    id="discount-input"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={discountStr}
                    onChange={(e) => setDiscountStr(e.target.value)}
                    className="h-10 font-mono"
                  />
                  <span className="text-xs text-muted-foreground">
                    Direct flat discount on billable room charge
                  </span>
                </div>
              </div>

              {/* Advance Payment Section */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Advance Payment
                  </span>
                  <Badge variant="outline" className="text-xs">
                    Optional at Check-in
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="advance-amount" className="text-xs font-semibold">
                      Advance Amount (₹)
                    </Label>
                    <Input
                      id="advance-amount"
                      type="number"
                      min={0}
                      placeholder="0"
                      value={advanceAmountStr}
                      onChange={(e) => setAdvanceAmountStr(e.target.value)}
                      className="h-10 font-mono font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="advance-mode" className="text-xs font-semibold">
                      Payment Mode
                    </Label>
                    <select
                      id="advance-mode"
                      value={advanceMode}
                      disabled={advanceAmount === 0}
                      onChange={(e) =>
                        setAdvanceMode(
                          e.target.value as "CASH" | "UPI" | "CARD" | "BANK_TRANSFER"
                        )
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI / QR Code</option>
                      <option value="CARD">Credit / Debit Card</option>
                      <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Navigation Back */}
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(3)}
                >
                  ← Back to Guest Info
                </Button>
              </div>
            </Card>
          </div>

          {/* Right Col: Bill Summary & Final Action Buttons */}
          <div className="space-y-6">
            <Card className="p-6 space-y-4 bg-card border-border sticky top-6 shadow-sm">
              <div className="border-b border-border pb-3">
                <h3 className="text-base font-bold text-foreground">Stay & Bill Breakdown</h3>
                <span className="text-xs text-muted-foreground">
                  Room {selectedRoom?.number} • {currentStay.days} {currentStay.days === 1 ? "day" : "days"}
                </span>
              </div>

              {/* Line items */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Room Charges ({currentStay.days}d × {formatINR(effectiveRate)})</span>
                  <span className="font-mono text-foreground">{formatINR(roomCharges)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discount</span>
                    <span className="font-mono">−{formatINR(discount)}</span>
                  </div>
                )}

                <div className="flex justify-between font-semibold pt-1 border-t border-border/60">
                  <span>Taxable Amount</span>
                  <span className="font-mono">{formatINR(taxableAmount)}</span>
                </div>

                <div className="flex justify-between text-muted-foreground pt-1">
                  <span>CGST ({gstPercent / 2}%)</span>
                  <span className="font-mono text-foreground">{formatINR(cgstAmount)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>SGST ({gstPercent / 2}%)</span>
                  <span className="font-mono text-foreground">{formatINR(sgstAmount)}</span>
                </div>

                <div className="flex justify-between text-sm font-bold pt-2 border-t border-border text-foreground">
                  <span>Estimated Total</span>
                  <span className="font-mono text-base">{formatINR(totalBill)}</span>
                </div>

                {advanceAmount > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Advance Collected ({advanceMode})</span>
                    <span className="font-mono">−{formatINR(advanceAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                  <span className={balanceDue > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}>
                    Balance Due at Check-out
                  </span>
                  <span className="font-mono text-base text-foreground">
                    {formatINR(balanceDue)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSubmitBooking("RESERVE")}
                  disabled={isPending}
                  className="w-full h-11 font-semibold text-xs border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                >
                  {isPending ? (
                    <SpinnerIcon className="size-4 animate-spin mr-2" />
                  ) : (
                    <CalendarIcon className="size-4 mr-2" />
                  )}
                  Save as Reservation
                </Button>

                <Button
                  type="button"
                  variant="default"
                  onClick={() => handleSubmitBooking("CHECK_IN")}
                  disabled={isPending}
                  className="w-full h-11 font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  {isPending ? (
                    <SpinnerIcon className="size-4 animate-spin mr-2" />
                  ) : (
                    <CheckInIcon className="size-4 mr-2" />
                  )}
                  Check In Now
                </Button>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-start gap-2">
                <InfoIcon className="size-3.5 shrink-0 text-muted-foreground mt-0.5" />
                <span>
                  Check-in activates the room state to Occupied immediately. Reservations hold the room until scheduled arrival.
                </span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ───────── SUCCESS CONFIRMATION MODAL ───────── */}
      {createdBooking && (
        <Dialog open={true} onOpenChange={() => { }}>
          <DialogContent className="sm:max-w-md p-6">
            <DialogHeader className="text-center sm:text-center space-y-2">
              <div className="size-12 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center mx-auto">
                <CheckIcon className="size-6" />
              </div>
              <DialogTitle className="text-xl font-bold">
                {createdBooking.status === "CHECKED_IN"
                  ? "Guest Checked In Successfully!"
                  : "Reservation Confirmed!"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                The room has been assigned and booking records are securely logged.
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3 text-xs my-2 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Booking Reference</span>
                <span className="font-bold text-primary text-sm">
                  {createdBooking.reference}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Room Assigned</span>
                <span className="font-bold text-foreground">
                  Room {createdBooking.roomNumber} ({createdBooking.roomTypeName})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Primary Guest</span>
                <span className="font-semibold text-foreground">
                  {createdBooking.primaryGuestName}
                </span>
              </div>
              {createdBooking.advancePaid > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="font-sans">Advance Received</span>
                  <span>{formatINR(createdBooking.advancePaid)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border font-sans font-bold">
                <span>Balance Due</span>
                <span className="font-mono text-sm">{formatINR(createdBooking.balanceDue)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreatedBooking(null);
                  router.push("/rooms");
                }}
                className="flex-1"
              >
                Go to Rooms Grid
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setCreatedBooking(null);
                  setCurrentStep(1);
                  setSelectedRoomId("");
                  setGuests([
                    {
                      id: "guest-primary",
                      name: "",
                      fatherName: "",
                      age: "",
                      sex: "MALE",
                      mobile: "",
                      isPrimary: true,
                    },
                  ]);
                  setCustomRate("");
                  setDiscountStr("0");
                  setAdvanceAmountStr("0");
                }}
                className="flex-1"
              >
                New Booking
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
