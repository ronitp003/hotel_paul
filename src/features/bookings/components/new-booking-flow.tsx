"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  formatIST,
  formatISTDateTime,
  fromISTInput,
  toISTInputString,
} from "@/lib/datetime";
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
  ChevronDownIcon,
  CheckIcon,
  ClockIcon,
  SpinnerIcon,
  ProblemIcon,
  InfoIcon,
  SearchIcon,
  CircleAlertIcon,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SelectDropdown } from "@/components/ui/select-dropdown";

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
  const [currentStep, setCurrentStep] = useState<number>(
    preselectedRoomId ? 2 : 1
  );

  // ───────── Step 1: Dates & Duration ─────────
  const defaultCheckIn = new Date();
  const defaultCheckOut = new Date(
    defaultCheckIn.getTime() + 24 * 60 * 60 * 1000
  );

  const [checkInStr, setCheckInStr] = useState<string>(() =>
    toISTInputString(defaultCheckIn)
  );
  const [checkOutStr, setCheckOutStr] = useState<string>(() =>
    toISTInputString(defaultCheckOut)
  );
  const [activePreset, setActivePreset] = useState<number | null>(24);

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
  type RoomStatusFilter =
    | "AVAILABLE"
    | "OCCUPIED"
    | "RESERVED"
    | "MAINTENANCE"
    | "ALL";
  const [statusFilter, setStatusFilter] =
    useState<RoomStatusFilter>("AVAILABLE");
  const [rooms, setRooms] = useState<AvailableRoomResult[]>(initialRooms);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    preselectedRoomId || ""
  );
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
    "WALK_IN" | "PHONE" | "REFERRAL"
  >("WALK_IN");
  const [arrivingFrom, setArrivingFrom] = useState("");
  const [purposeOfVisit, setPurposeOfVisit] = useState("");

  const [showCorporate, setShowCorporate] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");

  // Step-specific validation error states
  const [step1Error, setStep1Error] = useState<string | null>(null);

  interface Step3Errors {
    primaryName?: string;
    primaryPhone?: string;
    primaryFatherName?: string;
    primaryAge?: string;
    primarySex?: string;
    occupants?: Record<
      number,
      {
        name?: string;
        fatherName?: string;
        age?: string;
        sex?: string;
        mobile?: string;
      }
    >;
    arrivingFrom?: string;
    purposeOfVisit?: string;
    companyName?: string;
    corporateGstin?: string;
    companyAddress?: string;
    banner?: string;
  }
  const [step3Errors, setStep3Errors] = useState<Step3Errors>({});

  // Pre-confirmation verification modal state
  const [verifyAction, setVerifyAction] = useState<
    "RESERVE" | "CHECK_IN" | null
  >(null);

  // ───────── Step 4: Financials ─────────
  const [customRate, setCustomRate] = useState<string>("");
  const [discountStr, setDiscountStr] = useState<string>("0");
  const [advanceAmountStr, setAdvanceAmountStr] = useState<string>("");
  const [advanceMode, setAdvanceMode] = useState<
    "CASH" | "UPI" | "CARD" | "BANK_TRANSFER"
  >("CASH");

  // Effective rate applied
  const effectiveRate =
    customRate !== "" && !isNaN(Number(customRate))
      ? Number(customRate)
      : (selectedRoom?.pricePerNight ?? 0);

  const discount = Math.max(0, Number(discountStr) || 0);
  const advanceAmount = Math.max(0, Number(advanceAmountStr) || 0);

  // Live bill calculation
  const roomCharges = effectiveRate * currentStay.days;
  const taxableAmount = Math.max(0, roomCharges - discount);
  // GST Slab: 5% up to ₹7,500/night; 18% above
  const gstPercent = effectiveRate > 7500 ? 18 : 5;
  const cgstAmount =
    Math.round(((taxableAmount * gstPercent) / 200) * 100) / 100;
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
        const msg = "Check-out time must be strictly after check-in time.";
        setStep1Error(msg);
        toast.error(msg);
        return;
      }
      setStep1Error(null);

      const res = await findAvailableRoomsAction(
        start.toISOString(),
        end.toISOString()
      );
      if (res.ok && res.data) {
        setRooms(res.data.rooms);
        // If selected room is no longer available in the new window, reset it
        const stillAvail = res.data.rooms.find(
          (r) => r.id === selectedRoomId && r.isAvailable
        );
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

  // Split dates for Step 1
  const checkInDate = checkInStr ? checkInStr.slice(0, 10) : "";
  const checkInTime = checkInStr ? checkInStr.slice(11, 16) : "12:00";
  const checkOutDate = checkOutStr ? checkOutStr.slice(0, 10) : "";
  const checkOutTime = checkOutStr ? checkOutStr.slice(11, 16) : "12:00";

  const handleCheckInDateChange = (newDate: string) => {
    setActivePreset(null);
    setStep1Error(null);
    setCheckInStr(`${newDate}T${checkInTime || "12:00"}`);
  };

  const handleCheckInTimeChange = (newTime: string) => {
    setActivePreset(null);
    setStep1Error(null);
    setCheckInStr(
      `${checkInDate || toISTInputString(new Date()).slice(0, 10)}T${newTime}`
    );
  };

  const handleCheckOutDateChange = (newDate: string) => {
    setActivePreset(null);
    setStep1Error(null);
    setCheckOutStr(`${newDate}T${checkOutTime || "12:00"}`);
  };

  const handleCheckOutTimeChange = (newTime: string) => {
    setActivePreset(null);
    setStep1Error(null);
    setCheckOutStr(
      `${checkOutDate || toISTInputString(new Date()).slice(0, 10)}T${newTime}`
    );
  };

  // Preset dates helper
  const handleApplyPreset = (hoursOffset: number) => {
    const start = new Date();
    start.setMinutes(0, 0, 0); // clean hour
    const end = new Date(start.getTime() + hoursOffset * 60 * 60 * 1000);
    setStep1Error(null);
    setCheckInStr(toISTInputString(start));
    setCheckOutStr(toISTInputString(end));
    setActivePreset(hoursOffset);
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
    setStep3Errors((prev) => {
      if (!prev.occupants) return prev;
      const occ = { ...prev.occupants };
      delete occ[index];
      return {
        ...prev,
        occupants: Object.keys(occ).length > 0 ? occ : undefined,
        banner: undefined,
      };
    });
  };

  const handleUpdateGuest = (
    index: number,
    field: keyof GuestState,
    value: unknown
  ) => {
    setGuests((prev) =>
      prev.map((g, i) => (i === index ? { ...g, [field]: value } : g))
    );

    // Clear specific field error when edited
    if (index === 0) {
      if (field === "name" && step3Errors.primaryName) {
        setStep3Errors((prev) => ({
          ...prev,
          primaryName: undefined,
          banner: undefined,
        }));
      }
      if (field === "mobile" && step3Errors.primaryPhone) {
        setStep3Errors((prev) => ({
          ...prev,
          primaryPhone: undefined,
          banner: undefined,
        }));
      }
      if (field === "fatherName" && step3Errors.primaryFatherName) {
        setStep3Errors((prev) => ({
          ...prev,
          primaryFatherName: undefined,
          banner: undefined,
        }));
      }
      if (field === "age" && step3Errors.primaryAge) {
        setStep3Errors((prev) => ({
          ...prev,
          primaryAge: undefined,
          banner: undefined,
        }));
      }
      if (field === "sex" && step3Errors.primarySex) {
        setStep3Errors((prev) => ({
          ...prev,
          primarySex: undefined,
          banner: undefined,
        }));
      }
    } else {
      if (step3Errors.occupants?.[index]) {
        setStep3Errors((prev) => {
          const occ = { ...prev.occupants };
          if (occ[index]) {
            const updated = { ...occ[index] };
            if (field === "name") delete updated.name;
            if (field === "fatherName") delete updated.fatherName;
            if (field === "mobile") delete updated.mobile;
            if (field === "age") delete updated.age;
            if (field === "sex") delete updated.sex;
            if (Object.keys(updated).length === 0) {
              delete occ[index];
            } else {
              occ[index] = updated;
            }
          }
          return {
            ...prev,
            occupants: Object.keys(occ).length > 0 ? occ : undefined,
            banner: undefined,
          };
        });
      }
    }
  };

  // Step 3 Validation Function
  const validateStep3 = (): boolean => {
    const errors: Step3Errors = {};
    const occErrorsObj: Record<
      number,
      {
        name?: string;
        fatherName?: string;
        age?: string;
        sex?: string;
        mobile?: string;
      }
    > = {};

    const cleanDigits = (val: string) => val.replace(/\D/g, "");

    // 1. Primary Guest Name (Mandatory)
    if (!guests[0]?.name.trim()) {
      errors.primaryName = "Primary guest full name is required";
    } else if (guests[0].name.trim().length < 2) {
      errors.primaryName = "Full name must be at least 2 characters";
    }

    // 2. Primary Guest Mobile (Mandatory)
    if (!guests[0]?.mobile?.trim()) {
      errors.primaryPhone = "Mobile number is required";
    } else {
      const digits = cleanDigits(guests[0].mobile);
      if (digits.length < 10 || digits.length > 15) {
        errors.primaryPhone = "Please enter a valid 10-digit mobile number";
      }
    }

    // 3. Primary Guest Father / Husband Name (Optional)
    if (
      guests[0]?.fatherName?.trim() &&
      guests[0].fatherName.trim().length < 2
    ) {
      errors.primaryFatherName = "Name must be at least 2 characters";
    }

    // 4. Primary Guest Age (Mandatory)
    if (!guests[0]?.age || guests[0].age.trim() === "") {
      errors.primaryAge = "Age is required";
    } else {
      const ageNum = Number(guests[0].age);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 125) {
        errors.primaryAge = "Age must be between 1 and 125";
      }
    }

    // 5. Primary Guest Gender (Mandatory)
    if (!guests[0]?.sex) {
      errors.primarySex = "Gender is required";
    }

    // 6. Additional Occupants (if any added, all fields are Mandatory)
    guests.slice(1).forEach((occ, idx) => {
      const actualIdx = idx + 1;
      const occErr: {
        name?: string;
        fatherName?: string;
        age?: string;
        sex?: string;
        mobile?: string;
      } = {};

      if (!occ.name.trim()) {
        occErr.name = "Occupant full name is required";
      } else if (occ.name.trim().length < 2) {
        occErr.name = "Full name must be at least 2 characters";
      }

      if (occ.fatherName?.trim() && occ.fatherName.trim().length < 2) {
        occErr.fatherName = "Name must be at least 2 characters";
      }

      if (!occ.age || occ.age.trim() === "") {
        occErr.age = "Age is required";
      } else {
        const ageNum = Number(occ.age);
        if (isNaN(ageNum) || ageNum < 0 || ageNum > 125) {
          occErr.age = "Age must be between 0 and 125";
        }
      }

      if (!occ.sex) {
        occErr.sex = "Gender is required";
      }

      if (!occ.mobile?.trim()) {
        occErr.mobile = "Mobile number is required";
      } else {
        const digits = cleanDigits(occ.mobile);
        if (digits.length < 10 || digits.length > 15) {
          occErr.mobile = "Please enter a valid 10-digit mobile number";
        }
      }

      if (Object.keys(occErr).length > 0) {
        occErrorsObj[actualIdx] = occErr;
      }
    });

    if (Object.keys(occErrorsObj).length > 0) {
      errors.occupants = occErrorsObj;
    }

    // 7. Arriving From (Mandatory)
    if (!arrivingFrom.trim()) {
      errors.arrivingFrom = "Arriving from is required";
    }

    // 8. Purpose of Visit (Mandatory)
    if (!purposeOfVisit.trim()) {
      errors.purposeOfVisit = "Purpose of visit is required";
    }

    // 9. Corporate Details (Mandatory when enabled)
    if (showCorporate) {
      if (!companyName.trim()) {
        errors.companyName = "Company name is required";
      }
      if (!companyGstin.trim()) {
        errors.corporateGstin = "Company GSTIN is required";
      } else {
        const gstinRegex =
          /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
        if (!gstinRegex.test(companyGstin.trim())) {
          errors.corporateGstin =
            "Invalid GSTIN format (e.g. 22AAAAA0000A1Z5)";
        }
      }
      if (!companyAddress.trim()) {
        errors.companyAddress = "Company address is required";
      }
    }

    if (Object.keys(errors).length > 0) {
      errors.banner =
        "Please fill in all mandatory guest and visit details marked with * before proceeding.";
      setStep3Errors(errors);
      return false;
    }

    setStep3Errors({});
    return true;
  };

  // Open Verification Modal from Step 4
  const handleOpenVerifyModal = (action: "RESERVE" | "CHECK_IN") => {
    if (!selectedRoomId || !selectedRoom?.isAvailable) {
      toast.error("Please select an available room.");
      setCurrentStep(2);
      return;
    }

    if (!validateStep3()) {
      toast.error("Please complete all required guest details.");
      setCurrentStep(3);
      return;
    }

    if (advanceAmount > 0 && !advanceMode) {
      toast.error("Please select a payment mode for the advance payment.");
      return;
    }

    if (discount > roomCharges) {
      toast.error("Discount cannot exceed total room charges.");
      return;
    }

    setVerifyAction(action);
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

          setVerifyAction(null);
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

  // Counts by status
  const availableRoomsCount = rooms.filter((r) => r.isAvailable).length;
  const occupiedRoomsCount = rooms.filter(
    (r) => !r.isAvailable && r.unavailableType === "BOOKED"
  ).length;
  const reservedRoomsCount = rooms.filter(
    (r) => !r.isAvailable && r.unavailableType === "RESERVED"
  ).length;
  const maintenanceRoomsCount = rooms.filter(
    (r) => !r.isAvailable && r.unavailableType === "MAINTENANCE"
  ).length;

  const statusFilterConfig: Record<
    RoomStatusFilter,
    { label: string; count: number; badgeClass: string }
  > = {
    AVAILABLE: {
      label: "Available",
      count: availableRoomsCount,
      badgeClass:
        "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    },
    OCCUPIED: {
      label: "Occupied",
      count: occupiedRoomsCount,
      badgeClass:
        "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    },
    RESERVED: {
      label: "Reserved",
      count: reservedRoomsCount,
      badgeClass:
        "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    },
    MAINTENANCE: {
      label: "Maintenance",
      count: maintenanceRoomsCount,
      badgeClass:
        "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
    },
    ALL: {
      label: "All Statuses",
      count: rooms.length,
      badgeClass: "bg-muted text-muted-foreground border-border/50",
    },
  };

  // Filtered rooms
  const filteredRooms = rooms.filter((r) => {
    if (typeFilter !== "ALL" && r.typeId !== typeFilter) return false;
    if (
      searchFilter &&
      !r.number.toLowerCase().includes(searchFilter.toLowerCase().trim())
    ) {
      return false;
    }
    if (statusFilter !== "ALL") {
      if (statusFilter === "AVAILABLE" && !r.isAvailable) return false;
      if (
        statusFilter === "OCCUPIED" &&
        (r.isAvailable || r.unavailableType !== "BOOKED")
      ) {
        return false;
      }
      if (
        statusFilter === "RESERVED" &&
        (r.isAvailable || r.unavailableType !== "RESERVED")
      ) {
        return false;
      }
      if (
        statusFilter === "MAINTENANCE" &&
        (r.isAvailable || r.unavailableType !== "MAINTENANCE")
      ) {
        return false;
      }
    }
    return true;
  });

  const availableCount = filteredRooms.filter((r) => r.isAvailable).length;

  const selectedTypeName =
    typeFilter === "ALL"
      ? "All Room Types"
      : roomTypes.find((t) => t.id === typeFilter)?.name || "All Room Types";
  const selectedTypeCount =
    typeFilter === "ALL"
      ? rooms.length
      : rooms.filter((r) => r.typeId === typeFilter).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* ───────── Flow Header / Stepper Progress ───────── */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CalendarIcon
                className="size-6 text-primary"
                aria-hidden="true"
              />
              New Booking & Front Desk Check-in
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Select stay window, pick an available room, register guest
              particulars, and collect advance.
            </p>
          </div>
          {selectedRoom && (
            <Badge
              variant="outline"
              className="self-start sm:self-auto bg-primary/10 text-primary border-primary/20 text-xs py-1 px-3"
            >
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
                  if (step === 4) {
                    if (!validateStep3()) {
                      toast.error(
                        "Please complete all mandatory guest details before proceeding."
                      );
                      return;
                    }
                  }
                  if (
                    step < currentStep ||
                    (step === 2 && checkInStr && checkOutStr) ||
                    (step === 3 && selectedRoomId) ||
                    (step === 4 && selectedRoomId && validateStep3())
                  ) {
                    setCurrentStep(step);
                  }
                }}
                disabled={
                  step > currentStep &&
                  ((step === 2 && (!checkInStr || !checkOutStr)) ||
                    (step === 3 && !selectedRoomId) ||
                    (step === 4 && (!selectedRoomId || currentStep < 3)))
                }
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
                Set guest arrival and planned departure times. All stays are
                billed on 24-hour cycles.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Check-In Section: Separate Date & Time */}
            <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ClockIcon className="size-4 text-primary" />
                  Check-in (IST) *
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {checkInStr ? formatISTDateTime(fromISTInput(checkInStr)) : ""}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="checkin-date"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Check-in Date
                  </Label>
                  <Input
                    id="checkin-date"
                    type="date"
                    value={checkInDate}
                    onChange={(e) => handleCheckInDateChange(e.target.value)}
                    className="font-mono text-sm h-10 bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="checkin-time"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Check-in Time
                  </Label>
                  <Input
                    id="checkin-time"
                    type="time"
                    value={checkInTime}
                    onChange={(e) => handleCheckInTimeChange(e.target.value)}
                    className="font-mono text-sm h-10 bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Check-Out Section: Separate Date & Time */}
            <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ClockIcon className="size-4 text-primary" />
                  Check-out (IST) *
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {checkOutStr
                    ? formatISTDateTime(fromISTInput(checkOutStr))
                    : ""}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="checkout-date"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Check-out Date
                  </Label>
                  <Input
                    id="checkout-date"
                    type="date"
                    value={checkOutDate}
                    onChange={(e) => handleCheckOutDateChange(e.target.value)}
                    className="font-mono text-sm h-10 bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="checkout-time"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Check-out Time
                  </Label>
                  <Input
                    id="checkout-time"
                    type="time"
                    value={checkOutTime}
                    onChange={(e) => handleCheckOutTimeChange(e.target.value)}
                    className="font-mono text-sm h-10 bg-background"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick presets */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Stay Presets
            </span>
            <div className="flex flex-wrap gap-2.5">
              {[
                { hours: 24, label: "1 Night (24 Hours)" },
                { hours: 48, label: "2 Nights (48 Hours)" },
                { hours: 72, label: "3 Nights (72 Hours)" },
              ].map(({ hours, label }) => {
                const isSelected = activePreset === hours;
                return (
                  <Button
                    key={hours}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleApplyPreset(hours)}
                    className={cn(
                      "text-xs h-9 px-3.5 transition-all duration-200 cursor-pointer shadow-xs",
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm ring-2 ring-primary/30"
                        : "hover:bg-primary/10 hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    {isSelected && (
                      <CheckIcon className="size-3.5 mr-1.5 stroke-[2.5]" />
                    )}
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Inline Step 1 Error */}
          {step1Error && (
            <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium flex items-center gap-2">
              <CircleAlertIcon className="size-4 shrink-0 text-destructive" />
              <span>{step1Error}</span>
            </div>
          )}

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
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs"
                  >
                    Grace Absorbed ({graceMinutes}m)
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Total elapsed: {currentStay.hours} hours ({currentStay.minutes}{" "}
                minutes). Grace period: {graceMinutes} mins.
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
                {formatIST(fromISTInput(checkOutStr), "d MMM, h:mm a")} (
                {currentStay.days} {currentStay.days === 1 ? "day" : "days"})
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
              <div className="w-full sm:w-64">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        id="room-type-filter"
                        variant="outline"
                        aria-label="Filter by Room Type"
                        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-xs hover:bg-muted/60 hover:border-border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <RoomIcon
                            className="size-4 text-muted-foreground shrink-0"
                            aria-hidden="true"
                          />
                          <span className="truncate text-sm font-medium">
                            {selectedTypeName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-semibold px-1.5 py-0 bg-muted text-muted-foreground rounded-full border border-border/50"
                          >
                            {selectedTypeCount}
                          </Badge>
                          <ChevronDownIcon className="size-4 text-muted-foreground shrink-0 transition-transform duration-200" />
                        </div>
                      </Button>
                    }
                  />
                  <DropdownMenuContent
                    align="start"
                    sideOffset={6}
                    className="w-(--anchor-width) min-w-[260px] max-h-64 overflow-y-auto p-1.5 shadow-lg border border-border bg-popover z-50 rounded-lg"
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Filter by Room Type
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => setTypeFilter("ALL")}
                        className={cn(
                          "flex items-center justify-between gap-2 px-2.5 py-2 cursor-pointer text-sm rounded-md transition-colors",
                          typeFilter === "ALL"
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="size-4 flex items-center justify-center shrink-0">
                            {typeFilter === "ALL" && (
                              <CheckIcon className="size-3.5 text-primary stroke-[2.5]" />
                            )}
                          </div>
                          <span className="truncate">All Room Types</span>
                        </div>
                        <Badge
                          variant={
                            typeFilter === "ALL" ? "default" : "secondary"
                          }
                          className={cn(
                            "text-[11px] px-1.5 py-0 shrink-0 font-medium",
                            typeFilter === "ALL"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {rooms.length}
                        </Badge>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator className="my-1 border-border/60" />

                    <DropdownMenuGroup>
                      {roomTypes.map((type) => {
                        const count = rooms.filter(
                          (r) => r.typeId === type.id
                        ).length;
                        const isSelected = typeFilter === type.id;
                        return (
                          <DropdownMenuItem
                            key={type.id}
                            onClick={() => setTypeFilter(type.id)}
                            className={cn(
                              "flex items-center justify-between gap-2 px-2.5 py-2 cursor-pointer text-sm rounded-md transition-colors",
                              isSelected
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-foreground hover:bg-muted"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="size-4 flex items-center justify-center shrink-0">
                                {isSelected && (
                                  <CheckIcon className="size-3.5 text-primary stroke-[2.5]" />
                                )}
                              </div>
                              <span className="truncate">{type.name}</span>
                            </div>
                            <Badge
                              variant={isSelected ? "default" : "secondary"}
                              className={cn(
                                "text-[11px] px-1.5 py-0 shrink-0 font-medium",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {count}
                            </Badge>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Room Status Dropdown */}
              <div className="w-full sm:w-52">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        id="room-status-filter"
                        variant="outline"
                        aria-label="Filter by Room Status"
                        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-xs hover:bg-muted/60 hover:border-border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate text-sm font-medium">
                            {statusFilterConfig[statusFilter].label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[10px] font-semibold px-1.5 py-0 rounded-full border",
                              statusFilterConfig[statusFilter].badgeClass
                            )}
                          >
                            {statusFilterConfig[statusFilter].count}
                          </Badge>
                          <ChevronDownIcon className="size-4 text-muted-foreground shrink-0 transition-transform duration-200" />
                        </div>
                      </Button>
                    }
                  />
                  <DropdownMenuContent
                    align="start"
                    sideOffset={6}
                    className="w-(--anchor-width) min-w-[220px] p-1.5 shadow-lg border border-border bg-popover z-50 rounded-lg"
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Filter by Room Status
                      </DropdownMenuLabel>
                      {(
                        [
                          "AVAILABLE",
                          "OCCUPIED",
                          "RESERVED",
                          "MAINTENANCE",
                          "ALL",
                        ] as RoomStatusFilter[]
                      ).map((key) => {
                        const item = statusFilterConfig[key];
                        const isSelected = statusFilter === key;
                        return (
                          <DropdownMenuItem
                            key={key}
                            onClick={() => setStatusFilter(key)}
                            className={cn(
                              "flex items-center justify-between gap-2 px-2.5 py-2 cursor-pointer text-sm rounded-md transition-colors",
                              isSelected
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-foreground hover:bg-muted"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="size-4 flex items-center justify-center shrink-0">
                                {isSelected && (
                                  <CheckIcon className="size-3.5 text-primary stroke-[2.5]" />
                                )}
                              </div>
                              <span className="truncate">{item.label}</span>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px] px-1.5 py-0 shrink-0 font-medium",
                                item.badgeClass
                              )}
                            >
                              {item.count}
                            </Badge>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Availability Stats */}
            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs shrink-0 px-1">
              <span className="text-muted-foreground">
                Showing{" "}
                <strong className="text-foreground">
                  {filteredRooms.length}
                </strong>{" "}
                of {rooms.length} rooms
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
                <p className="text-sm font-medium">
                  No rooms match your filter criteria.
                </p>
                <p className="text-xs text-muted-foreground">
                  Try clearing your search or switching back to &ldquo;All Room
                  Types&rdquo;.
                </p>
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
                                    : room.unavailableType === "BOOKED"
                                      ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                                      : room.unavailableType === "MAINTENANCE"
                                        ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
                                        : "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900 dark:text-stone-300"
                              )}
                            >
                              {isAvail
                                ? "Available"
                                : room.unavailableType === "RESERVED"
                                  ? "Reserved"
                                  : room.unavailableType === "BOOKED"
                                    ? "Occupied"
                                    : room.unavailableType === "MAINTENANCE"
                                      ? "Maintenance"
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
                            <span className="text-xs text-muted-foreground">
                              / night
                            </span>
                          </div>
                          {isAvail && (
                            <span className="text-xs text-muted-foreground">
                              Estimated total:{" "}
                              <strong className="text-foreground">
                                {formatINR(
                                  room.pricePerNight * currentStay.days
                                )}
                              </strong>{" "}
                              ({currentStay.days}d)
                            </span>
                          )}
                        </div>

                        {/* Open problem warning */}
                        {room.hasProblem && (
                          <div className="space-y-1.5 text-xs text-amber-800 dark:text-amber-200 bg-amber-500/10 p-2 rounded-md border border-amber-500/30">
                            <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
                              <ProblemIcon className="size-3.5 shrink-0" />
                              <span>
                                {room.openProblemsCount} Unresolved Issue(s)
                              </span>
                            </div>
                            {room.openProblems && room.openProblems.length > 0 && (
                              <div className="space-y-1 pt-0.5">
                                {room.openProblems.map((prob) => (
                                  <div
                                    key={prob.id}
                                    className="p-1.5 rounded bg-background/80 border border-amber-500/20 text-xs space-y-0.5"
                                  >
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                                      <span className="font-bold text-amber-600 dark:text-amber-400">
                                        {prob.severity}
                                      </span>
                                    </div>
                                    <p className="text-foreground font-medium whitespace-pre-wrap">
                                      {prob.description}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
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
                          <span className="text-muted-foreground font-normal">
                            •
                          </span>
                          <span className="text-muted-foreground font-medium">
                            {selectedRoom.typeName}
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Selected for check-in
                        </span>
                      </div>
                    </div>

                    <div className="hidden md:block h-8 w-px bg-border/80" />

                    <div className="flex items-center justify-center sm:justify-start gap-3 sm:gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Duration
                        </span>
                        <strong className="text-foreground font-semibold">
                          {currentStay.days}{" "}
                          {currentStay.days === 1 ? "Day" : "Days"}
                        </strong>
                      </div>
                      <div className="h-5 w-px bg-border/80" />
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Est. Total
                        </span>
                        <span className="text-sm sm:text-base font-bold text-primary">
                          {formatINR(
                            selectedRoom.pricePerNight * currentStay.days
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground text-xs sm:text-sm py-1">
                    <InfoIcon className="size-4 shrink-0 text-muted-foreground/80" />
                    <span>
                      Please select an available room from the list to continue.
                    </span>
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
                      toast.error(
                        "Please select an available room to proceed."
                      );
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
                Enter primary guest particulars and add any accompanying
                occupants.
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
              <Badge
                variant="outline"
                className="text-xs bg-primary/5 text-primary border-primary/20"
              >
                Main Contact
              </Badge>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="primary-name"
                    className="text-xs font-semibold"
                  >
                    Full Name *
                  </Label>
                  <Input
                    id="primary-name"
                    placeholder="e.g. Satyajit Ray"
                    value={guests[0].name}
                    onChange={(e) =>
                      handleUpdateGuest(0, "name", e.target.value)
                    }
                    className={cn(
                      "h-9",
                      step3Errors.primaryName &&
                        "border-destructive focus-visible:ring-destructive"
                    )}
                    autoFocus
                  />
                  {step3Errors.primaryName && (
                    <p className="text-[11px] text-destructive font-medium">
                      {step3Errors.primaryName}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="primary-phone"
                    className="text-xs font-semibold"
                  >
                    Mobile Number *
                  </Label>
                  <Input
                    id="primary-phone"
                    placeholder="10-digit mobile"
                    value={guests[0].mobile}
                    onChange={(e) =>
                      handleUpdateGuest(0, "mobile", e.target.value)
                    }
                    className={cn(
                      "h-9 font-mono",
                      step3Errors.primaryPhone &&
                        "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {step3Errors.primaryPhone && (
                    <p className="text-[11px] text-destructive font-medium">
                      {step3Errors.primaryPhone}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="primary-father"
                    className="text-xs font-semibold"
                  >
                    Father / Husband Name (Optional)
                  </Label>
                  <Input
                    id="primary-father"
                    placeholder="Father/Husband name"
                    value={guests[0].fatherName}
                    onChange={(e) =>
                      handleUpdateGuest(0, "fatherName", e.target.value)
                    }
                    className={cn(
                      "h-9",
                      step3Errors.primaryFatherName &&
                        "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {step3Errors.primaryFatherName && (
                    <p className="text-[11px] text-destructive font-medium">
                      {step3Errors.primaryFatherName}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="primary-age"
                    className="text-xs font-semibold"
                  >
                    Age *
                  </Label>
                  <Input
                    id="primary-age"
                    type="number"
                    min={1}
                    max={120}
                    placeholder="Age"
                    value={guests[0].age}
                    onChange={(e) =>
                      handleUpdateGuest(0, "age", e.target.value)
                    }
                    className={cn(
                      "h-9 font-mono",
                      step3Errors.primaryAge &&
                        "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {step3Errors.primaryAge && (
                    <p className="text-[11px] text-destructive font-medium">
                      {step3Errors.primaryAge}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="primary-sex"
                    className="text-xs font-semibold"
                  >
                    Gender *
                  </Label>
                  <SelectDropdown
                    id="primary-sex"
                    value={guests[0].sex}
                    onChange={(val) =>
                      handleUpdateGuest(
                        0,
                        "sex",
                        val as "MALE" | "FEMALE" | "OTHER"
                      )
                    }
                    options={[
                      { value: "MALE", label: "Male" },
                      { value: "FEMALE", label: "Female" },
                      { value: "OTHER", label: "Other" },
                    ]}
                    placeholder="Select gender"
                    error={Boolean(step3Errors.primarySex)}
                  />
                  {step3Errors.primarySex && (
                    <p className="text-[11px] text-destructive font-medium">
                      {step3Errors.primarySex}
                    </p>
                  )}
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
              const occErr = step3Errors.occupants?.[actualIdx];

              return (
                <div
                  key={guest.id}
                  className="p-4 sm:p-5 rounded-xl border border-border bg-card space-y-4 relative shadow-2xs"
                >
                  <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="text-xs font-semibold px-2 py-0.5"
                      >
                        Occupant #{actualIdx + 1}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-medium">
                        Accompanying Guest
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveGuest(actualIdx)}
                      className="text-destructive hover:bg-destructive/10 h-7 text-xs px-2.5"
                    >
                      <DeleteIcon className="size-3.5 mr-1" />
                      Remove Occupant
                    </Button>
                  </div>

                  {/* 2-Row Spacious Layout */}
                  <div className="space-y-3.5">
                    {/* Row 1: Full Name and Father/Husband Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor={`occ-name-${actualIdx}`}
                          className="text-xs font-semibold"
                        >
                          Full Name *
                        </Label>
                        <Input
                          id={`occ-name-${actualIdx}`}
                          placeholder="Occupant's full name"
                          value={guest.name}
                          onChange={(e) =>
                            handleUpdateGuest(actualIdx, "name", e.target.value)
                          }
                          className={cn(
                            "h-9 text-sm",
                            occErr?.name &&
                              "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        {occErr?.name && (
                          <p className="text-[11px] text-destructive font-medium">
                            {occErr.name}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor={`occ-father-${actualIdx}`}
                          className="text-xs font-semibold"
                        >
                          Father / Husband Name (Optional)
                        </Label>
                        <Input
                          id={`occ-father-${actualIdx}`}
                          placeholder="Father or husband name"
                          value={guest.fatherName}
                          onChange={(e) =>
                            handleUpdateGuest(
                              actualIdx,
                              "fatherName",
                              e.target.value
                            )
                          }
                          className={cn(
                            "h-9 text-sm",
                            occErr?.fatherName &&
                              "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        {occErr?.fatherName && (
                          <p className="text-[11px] text-destructive font-medium">
                            {occErr.fatherName}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Age, Gender, Mobile */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                      <div className="sm:col-span-3 space-y-1.5">
                        <Label
                          htmlFor={`occ-age-${actualIdx}`}
                          className="text-xs font-semibold"
                        >
                          Age *
                        </Label>
                        <Input
                          id={`occ-age-${actualIdx}`}
                          type="number"
                          min={0}
                          max={120}
                          placeholder="Age"
                          value={guest.age}
                          onChange={(e) =>
                            handleUpdateGuest(actualIdx, "age", e.target.value)
                          }
                          className={cn(
                            "h-9 text-sm font-mono",
                            occErr?.age &&
                              "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        {occErr?.age && (
                          <p className="text-[11px] text-destructive font-medium">
                            {occErr.age}
                          </p>
                        )}
                      </div>

                      <div className="sm:col-span-4 space-y-1.5">
                        <Label
                          htmlFor={`occ-gender-${actualIdx}`}
                          className="text-xs font-semibold"
                        >
                          Gender *
                        </Label>
                        <SelectDropdown
                          id={`occ-gender-${actualIdx}`}
                          value={guest.sex}
                          onChange={(val) =>
                            handleUpdateGuest(
                              actualIdx,
                              "sex",
                              val as "MALE" | "FEMALE" | "OTHER"
                            )
                          }
                          options={[
                            { value: "MALE", label: "Male" },
                            { value: "FEMALE", label: "Female" },
                            { value: "OTHER", label: "Other" },
                          ]}
                          placeholder="Select gender"
                          error={Boolean(occErr?.sex)}
                        />
                        {occErr?.sex && (
                          <p className="text-[11px] text-destructive font-medium">
                            {occErr.sex}
                          </p>
                        )}
                      </div>

                      <div className="sm:col-span-5 space-y-1.5">
                        <Label
                          htmlFor={`occ-mobile-${actualIdx}`}
                          className="text-xs font-semibold"
                        >
                          Mobile Number *
                        </Label>
                        <Input
                          id={`occ-mobile-${actualIdx}`}
                          placeholder="10-digit mobile"
                          value={guest.mobile}
                          onChange={(e) =>
                            handleUpdateGuest(
                              actualIdx,
                              "mobile",
                              e.target.value
                            )
                          }
                          className={cn(
                            "h-9 text-sm font-mono",
                            occErr?.mobile &&
                              "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        {occErr?.mobile && (
                          <p className="text-[11px] text-destructive font-medium">
                            {occErr.mobile}
                          </p>
                        )}
                      </div>
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
                <Label
                  htmlFor="booking-source"
                  className="text-xs font-semibold"
                >
                  Booking Source
                </Label>
                <SelectDropdown
                  id="booking-source"
                  value={bookingSource}
                  onChange={(val) =>
                    setBookingSource(
                      val as "WALK_IN" | "PHONE" | "REFERRAL"
                    )
                  }
                  options={[
                    { value: "WALK_IN", label: "Walk-In" },
                    { value: "PHONE", label: "Phone Reservation" },
                    { value: "REFERRAL", label: "Referral" },
                  ]}
                  placeholder="Select booking source"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="arriving-from"
                  className="text-xs font-semibold"
                >
                  Arriving From *
                </Label>
                <Input
                  id="arriving-from"
                  placeholder="e.g. Kolkata, Asansol"
                  value={arrivingFrom}
                  onChange={(e) => {
                    setArrivingFrom(e.target.value);
                    if (step3Errors.arrivingFrom) {
                      setStep3Errors((prev) => ({
                        ...prev,
                        arrivingFrom: undefined,
                        banner: undefined,
                      }));
                    }
                  }}
                  className={cn(
                    "h-9",
                    step3Errors.arrivingFrom &&
                      "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {step3Errors.arrivingFrom && (
                  <p className="text-[11px] text-destructive font-medium">
                    {step3Errors.arrivingFrom}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="purpose-visit"
                  className="text-xs font-semibold"
                >
                  Purpose of Visit *
                </Label>
                <Input
                  id="purpose-visit"
                  placeholder="e.g. Tourism / University"
                  value={purposeOfVisit}
                  onChange={(e) => {
                    setPurposeOfVisit(e.target.value);
                    if (step3Errors.purposeOfVisit) {
                      setStep3Errors((prev) => ({
                        ...prev,
                        purposeOfVisit: undefined,
                        banner: undefined,
                      }));
                    }
                  }}
                  className={cn(
                    "h-9",
                    step3Errors.purposeOfVisit &&
                      "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {step3Errors.purposeOfVisit && (
                  <p className="text-[11px] text-destructive font-medium">
                    {step3Errors.purposeOfVisit}
                  </p>
                )}
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
              <span>
                {showCorporate ? "− Hide" : "+ Add"} Corporate / GSTIN Billing
                Details
              </span>
            </button>

            {showCorporate && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3 p-4 rounded-xl bg-muted/30 border border-border">
                <div className="space-y-1.5">
                  <Label htmlFor="company-name" className="text-xs font-semibold">
                    Company Name *
                  </Label>
                  <Input
                    id="company-name"
                    placeholder="e.g. ABC Technologies Pvt Ltd"
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      if (step3Errors.companyName) {
                        setStep3Errors((prev) => ({
                          ...prev,
                          companyName: undefined,
                          banner: undefined,
                        }));
                      }
                    }}
                    className={cn(
                      "h-8 text-sm",
                      step3Errors.companyName &&
                        "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {step3Errors.companyName && (
                    <p className="text-[11px] text-destructive font-medium">
                      {step3Errors.companyName}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-gstin" className="text-xs font-semibold">
                    Company GSTIN *
                  </Label>
                  <Input
                    id="company-gstin"
                    placeholder="15-character GSTIN"
                    value={companyGstin}
                    onChange={(e) => {
                      setCompanyGstin(e.target.value.toUpperCase());
                      if (step3Errors.corporateGstin) {
                        setStep3Errors((prev) => ({
                          ...prev,
                          corporateGstin: undefined,
                          banner: undefined,
                        }));
                      }
                    }}
                    className={cn(
                      "h-8 text-sm font-mono",
                      step3Errors.corporateGstin &&
                        "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {step3Errors.corporateGstin && (
                    <p className="text-[11px] text-destructive font-medium">
                      {step3Errors.corporateGstin}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-addr" className="text-xs font-semibold">
                    Company Address *
                  </Label>
                  <Input
                    id="company-addr"
                    placeholder="City / Address"
                    value={companyAddress}
                    onChange={(e) => {
                      setCompanyAddress(e.target.value);
                      if (step3Errors.companyAddress) {
                        setStep3Errors((prev) => ({
                          ...prev,
                          companyAddress: undefined,
                          banner: undefined,
                        }));
                      }
                    }}
                    className={cn(
                      "h-8 text-sm",
                      step3Errors.companyAddress &&
                        "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {step3Errors.companyAddress && (
                    <p className="text-[11px] text-destructive font-medium">
                      {step3Errors.companyAddress}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Inline Step 3 Error Banner */}
          {step3Errors.banner && (
            <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium flex items-center gap-2">
              <CircleAlertIcon className="size-4 shrink-0 text-destructive" />
              <span>{step3Errors.banner}</span>
            </div>
          )}

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
                if (!validateStep3()) {
                  toast.error(
                    "Please complete all mandatory guest details before proceeding."
                  );
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
                  Review room tariff, apply any agreed discounts, and record
                  advance payment.
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
                    Standard tariff:{" "}
                    {formatINR(selectedRoom?.pricePerNight ?? 0)}/night
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="discount-input"
                    className="text-xs font-semibold"
                  >
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
                    <Label
                      htmlFor="advance-amount"
                      className="text-xs font-semibold"
                    >
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
                    <Label
                      htmlFor="advance-mode"
                      className="text-xs font-semibold"
                    >
                      Payment Mode
                    </Label>
                    <SelectDropdown
                      id="advance-mode"
                      value={advanceMode}
                      disabled={advanceAmount === 0}
                      onChange={(val) =>
                        setAdvanceMode(
                          val as
                            | "CASH"
                            | "UPI"
                            | "CARD"
                            | "BANK_TRANSFER"
                        )
                      }
                      options={[
                        { value: "CASH", label: "Cash" },
                        { value: "UPI", label: "UPI / QR Code" },
                        { value: "CARD", label: "Credit / Debit Card" },
                        {
                          value: "BANK_TRANSFER",
                          label: "Bank Transfer / NEFT",
                        },
                      ]}
                      size="lg"
                    />
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
                <h3 className="text-base font-bold text-foreground">
                  Stay & Bill Breakdown
                </h3>
                <span className="text-xs text-muted-foreground">
                  Room {selectedRoom?.number} • {currentStay.days}{" "}
                  {currentStay.days === 1 ? "day" : "days"}
                </span>
              </div>

              {/* Line items */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    Room Charges ({currentStay.days}d ×{" "}
                    {formatINR(effectiveRate)})
                  </span>
                  <span className="font-mono text-foreground">
                    {formatINR(roomCharges)}
                  </span>
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
                  <span className="font-mono text-foreground">
                    {formatINR(cgstAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>SGST ({gstPercent / 2}%)</span>
                  <span className="font-mono text-foreground">
                    {formatINR(sgstAmount)}
                  </span>
                </div>

                <div className="flex justify-between text-sm font-bold pt-2 border-t border-border text-foreground">
                  <span>Estimated Total</span>
                  <span className="font-mono text-base">
                    {formatINR(totalBill)}
                  </span>
                </div>

                {advanceAmount > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Advance Collected ({advanceMode})</span>
                    <span className="font-mono">
                      −{formatINR(advanceAmount)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                  <span
                    className={
                      balanceDue > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600"
                    }
                  >
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
                  onClick={() => handleOpenVerifyModal("RESERVE")}
                  disabled={isPending}
                  className="w-full h-11 font-semibold text-xs border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                >
                  <CalendarIcon className="size-4 mr-2" />
                  Save as Reservation
                </Button>

                <Button
                  type="button"
                  variant="default"
                  onClick={() => handleOpenVerifyModal("CHECK_IN")}
                  disabled={isPending}
                  className="w-full h-11 font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <CheckInIcon className="size-4 mr-2" />
                  Check In Now
                </Button>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-start gap-2">
                <InfoIcon className="size-3.5 shrink-0 text-muted-foreground mt-0.5" />
                <span>
                  Check-in activates the room state to Occupied immediately.
                  Reservations hold the room until scheduled arrival.
                </span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ───────── PRE-CONFIRMATION / VERIFICATION MODAL ───────── */}
      <Dialog
        open={verifyAction !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setVerifyAction(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
          <DialogHeader className="space-y-1.5 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-semibold px-2.5 py-0.5",
                  verifyAction === "CHECK_IN"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                )}
              >
                {verifyAction === "CHECK_IN"
                  ? "Immediate Check-In"
                  : "Advance Reservation"}
              </Badge>
            </div>
            <DialogTitle className="text-lg sm:text-xl font-bold">
              {verifyAction === "CHECK_IN"
                ? "Verify Check-In Details"
                : "Verify Reservation Details"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Please review all booking, guest, and financial details carefully.
              If anything needs correction, click &ldquo;Back to Edit&rdquo; to
              fix it before confirming.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs">
            {/* Section 1: Room & Stay Window */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <RoomIcon className="size-3.5" />
                Room & Stay Window
              </span>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                <div>
                  <span className="text-muted-foreground font-sans block text-[11px]">
                    Room Assigned
                  </span>
                  <span className="font-bold text-foreground text-sm">
                    Room {selectedRoom?.number} ({selectedRoom?.typeName})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-sans block text-[11px]">
                    Effective Tariff
                  </span>
                  <span className="font-bold text-foreground text-sm">
                    {formatINR(effectiveRate)} / night
                  </span>
                </div>
                <div className="col-span-2 pt-1.5 border-t border-border/50">
                  <span className="text-muted-foreground font-sans block text-[11px]">
                    Stay Window (IST)
                  </span>
                  <span className="font-medium text-foreground">
                    {checkInStr
                      ? formatISTDateTime(fromISTInput(checkInStr))
                      : ""}{" "}
                    →{" "}
                    {checkOutStr
                      ? formatISTDateTime(fromISTInput(checkOutStr))
                      : ""}
                  </span>
                  <span className="text-muted-foreground text-[11px] ml-1.5 font-sans">
                    ({currentStay.days}{" "}
                    {currentStay.days === 1 ? "day" : "days"},{" "}
                    {currentStay.hours}h)
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Guest Particulars */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <GuestIcon className="size-3.5" />
                Guest Particulars
              </span>
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Primary Guest
                    </span>
                    <strong className="text-foreground">
                      {guests[0]?.name}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Mobile Number
                    </span>
                    <span className="font-mono">
                      {guests[0]?.mobile || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Father / Husband
                    </span>
                    <span>{guests[0]?.fatherName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Age & Gender
                    </span>
                    <span>
                      {guests[0]?.age ? `${guests[0].age} yrs` : "—"},{" "}
                      {guests[0]?.sex}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Booking Source
                    </span>
                    <span>
                      {bookingSource === "WALK_IN"
                        ? "Walk-In"
                        : bookingSource === "PHONE"
                          ? "Phone Reservation"
                          : "Referral"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Arriving From
                    </span>
                    <span>{arrivingFrom || "—"}</span>
                  </div>
                </div>

                {/* Additional Occupants */}
                {guests.length > 1 && (
                  <div className="pt-2 border-t border-border/50 space-y-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Additional Occupants ({guests.length - 1}):
                    </span>
                    <div className="space-y-1 bg-card p-2 rounded-lg border border-border/60">
                      {guests.slice(1).map((occ, i) => (
                        <div
                          key={occ.id}
                          className="flex flex-wrap items-center justify-between text-[11px] py-1 border-b border-border/30 last:border-0"
                        >
                          <span className="font-semibold text-foreground">
                            {i + 1}. {occ.name}
                          </span>
                          <span className="text-muted-foreground">
                            {occ.fatherName
                              ? `Father/Husband: ${occ.fatherName}`
                              : ""}
                            {occ.age ? ` • ${occ.age} yrs` : ""}
                            {occ.sex ? ` • ${occ.sex}` : ""}
                            {occ.mobile ? ` • ${occ.mobile}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Corporate Details */}
                {companyName && (
                  <div className="pt-2 border-t border-border/50 text-[11px]">
                    <span className="text-muted-foreground block">
                      Corporate Billing:
                    </span>
                    <span className="font-medium text-foreground">
                      {companyName}{" "}
                      {companyGstin ? `(GSTIN: ${companyGstin})` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Billing & Financials */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <RupeeIcon className="size-3.5" />
                Financial Summary
              </span>
              <div className="space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-sans">
                    Room Charges ({currentStay.days}d)
                  </span>
                  <span>{formatINR(roomCharges)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span className="font-sans">Discount</span>
                    <span>−{formatINR(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span className="font-sans">
                    GST (CGST + SGST @ {gstPercent}%)
                  </span>
                  <span>{formatINR(cgstAmount + sgstAmount)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border font-bold text-foreground">
                  <span className="font-sans">Total Bill</span>
                  <span className="text-sm">{formatINR(totalBill)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="font-sans">Advance to Collect</span>
                  <span>
                    {advanceAmount > 0
                      ? `${formatINR(advanceAmount)} (${advanceMode})`
                      : "₹0 (Nil)"}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border font-bold text-foreground">
                  <span className="font-sans">Balance Due on Check-out</span>
                  <span className="text-sm font-bold text-primary">
                    {formatINR(balanceDue)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVerifyAction(null)}
              disabled={isPending}
              className="w-full sm:w-auto h-10 px-5 text-xs font-semibold"
            >
              ← Back to Edit
            </Button>

            <Button
              type="button"
              variant="default"
              onClick={() => {
                if (verifyAction) {
                  handleSubmitBooking(verifyAction);
                }
              }}
              disabled={isPending}
              className={cn(
                "w-full sm:w-auto h-10 px-6 text-xs font-semibold shadow-xs text-white",
                verifyAction === "CHECK_IN"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-amber-600 hover:bg-amber-700"
              )}
            >
              {isPending ? (
                <>
                  <SpinnerIcon className="size-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckIcon className="size-4 mr-2" />
                  {verifyAction === "CHECK_IN"
                    ? "Confirm & Check In Now"
                    : "Confirm & Save Reservation"}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───────── SUCCESS CONFIRMATION MODAL ───────── */}
      {createdBooking && (
        <Dialog open={true} onOpenChange={() => {}}>
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
                The room has been assigned and booking records are securely
                logged.
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3 text-xs my-2 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">
                  Booking Reference
                </span>
                <span className="font-bold text-primary text-sm">
                  {createdBooking.reference}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">
                  Room Assigned
                </span>
                <span className="font-bold text-foreground">
                  Room {createdBooking.roomNumber} (
                  {createdBooking.roomTypeName})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">
                  Primary Guest
                </span>
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
                <span className="font-mono text-sm">
                  {formatINR(createdBooking.balanceDue)}
                </span>
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
