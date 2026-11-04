"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { format, addDays, subDays, parseISO } from "date-fns";
import {
  RegisterDayData,
  GuestInfo,
} from "@/features/register/schemas";
import { generateRegisterCsv } from "@/features/register/export-csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  ClockIcon,
  GuestIcon,
  DownloadIcon,
  SpinnerIcon,
} from "@/lib/icons";
import { formatISTTime } from "@/lib/datetime";

export { generateRegisterCsv } from "@/features/register/export-csv";

interface CheckInRegisterTabProps {
  initialData: RegisterDayData;
  rooms: Array<{ id: string; number: string; typeName: string }>;
}

export function CheckInRegisterTab({
  initialData,
  rooms,
}: CheckInRegisterTabProps) {
  const [data, setData] = useState<RegisterDayData>(initialData);
  const [selectedDate, setSelectedDate] = useState<string>(initialData.date);
  const [search, setSearch] = useState("");
  const [roomFilter, setRoomFilter] = useState("ALL");
  const [isPending, startTransition] = useTransition();

  // Dialog state for viewing accompanying guests
  const [selectedAccompanying, setSelectedAccompanying] = useState<{
    primaryName: string;
    roomNumber: string;
    reference: string;
    guests: GuestInfo[];
  } | null>(null);

  // Fetch data when date, room, or search change
  const fetchData = async (
    targetDate: string,
    targetRoom: string = roomFilter,
    targetSearch: string = search
  ) => {
    startTransition(async () => {
      try {
        const params = new URLSearchParams();
        if (targetDate) params.set("date", targetDate);
        if (targetRoom !== "ALL") params.set("roomId", targetRoom);
        if (targetSearch.trim()) params.set("search", targetSearch.trim());

        const res = await fetch(`/api/register?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch register data");
        const json = await res.json();
        if (json.ok && json.data?.register) {
          setData(json.data.register);
        }
      } catch (err) {
        console.error("Error loading register data:", err);
      }
    });
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    fetchData(newDate, roomFilter, search);
  };

  const handlePrevDay = () => {
    const prev = format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd");
    handleDateChange(prev);
  };

  const handleNextDay = () => {
    const next = format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd");
    handleDateChange(next);
  };

  const handleToday = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    handleDateChange(today);
  };

  const handleYesterday = () => {
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    handleDateChange(yesterday);
  };

  const handleRoomFilter = (val: string) => {
    setRoomFilter(val);
    fetchData(selectedDate, val, search);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(selectedDate, roomFilter, search);
  };

  // Client-side quick filter for instant search responsiveness
  const filteredEntries = useMemo(() => {
    if (!search.trim()) return data.entries;
    const q = search.trim().toLowerCase();
    return data.entries.filter((entry) => {
      const pName = entry.primaryGuest.name.toLowerCase();
      const pMobile = entry.primaryGuest.mobile?.toLowerCase() || "";
      const pFather = entry.primaryGuest.fatherName?.toLowerCase() || "";
      const ref = entry.reference.toLowerCase();
      const rNum = entry.roomNumber.toLowerCase();
      const origin = entry.arrivingFrom?.toLowerCase() || "";
      const purpose = entry.purposeOfVisit?.toLowerCase() || "";
      const hasAccompanyingMatch = entry.accompanyingGuests.some(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.mobile && g.mobile.toLowerCase().includes(q))
      );

      return (
        pName.includes(q) ||
        pMobile.includes(q) ||
        pFather.includes(q) ||
        ref.includes(q) ||
        rNum.includes(q) ||
        origin.includes(q) ||
        purpose.includes(q) ||
        hasAccompanyingMatch
      );
    });
  }, [data.entries, search]);

  // Export to CSV
  const handleExportCSV = () => {
    const csvContent = generateRegisterCsv(filteredEntries);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Hotel_Paul_Checkin_Register_${selectedDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const yesterdayStr = format(subDays(new Date(), 1), "yyyy-MM-dd");

  const roomOptions = [
    { label: "All Rooms", value: "ALL" },
    ...rooms.map((r) => ({
      label: `Room ${r.number} (${r.typeName})`,
      value: r.id,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* ── Top Bar Controls: Day Picker & Actions ── */}
      <div className="flex flex-col gap-2.5 sm:gap-4 md:flex-row md:items-center md:justify-between print:hidden">
        {/* Day selection: Strictly day-by-day (No weeks) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border bg-card p-0.5 sm:p-1 shadow-2xs">
            <Button
              variant={selectedDate === todayStr ? "default" : "ghost"}
              size="sm"
              onClick={handleToday}
              className="h-7.5 sm:h-8 px-2.5 text-xs font-medium"
            >
              Today
            </Button>
            <Button
              variant={selectedDate === yesterdayStr ? "default" : "ghost"}
              size="sm"
              onClick={handleYesterday}
              className="h-7.5 sm:h-8 px-2.5 text-xs font-medium"
            >
              Yesterday
            </Button>
          </div>

          <div className="inline-flex items-center rounded-lg border bg-card p-0.5 sm:p-1 shadow-2xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevDay}
              className="size-7.5 sm:size-8"
              title="Previous Day"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>

            <div className="flex items-center gap-1.5 px-1.5 sm:px-2">
              <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="h-7.5 sm:h-8 rounded bg-transparent px-1 text-xs font-medium outline-none focus:ring-1 focus:ring-primary max-w-[125px] sm:max-w-none"
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextDay}
              className="size-7.5 sm:size-8"
              title="Next Day"
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>

          {isPending && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
              <SpinnerIcon className="size-3.5 animate-spin text-primary" />
              <span>Updating...</span>
            </div>
          )}
        </div>

        {/* Action Buttons: CSV Export */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 sm:h-9 px-3 gap-1.5 text-xs font-medium shadow-2xs"
          >
            <DownloadIcon className="size-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* ── Day Summary Card ── */}
      <div className="rounded-xl border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
                {data.formattedDate}
              </h2>
              {selectedDate === todayStr && (
                <Badge variant="outline" className="border-primary-border bg-primary-light text-primary dark:bg-primary-subtle dark:text-primary dark:border-primary-border text-[10px] py-0 px-1.5 h-4.5">
                  Today
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-none">
              Official guest check-in register for local authority record and hotel daily log.
            </p>
          </div>

          <div className="shrink-0">
            <div className="rounded-lg border bg-card px-3 py-1.5 text-center shadow-xs">
              <div className="text-lg sm:text-xl font-bold tracking-tight text-primary leading-tight">
                {data.totalCheckIns}
              </div>
              <div className="text-[10px] sm:text-[11px] font-medium text-muted-foreground leading-tight">
                Check-ins
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <form
          onSubmit={handleSearchSubmit}
          className="relative flex-1 max-w-md"
        >
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by guest, father's name, phone, room, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </form>

        <div className="flex items-center gap-2">
          <div className="w-56">
            <SelectDropdown
              value={roomFilter}
              onChange={handleRoomFilter}
              options={roomOptions}
              placeholder="Filter by room"
              className="h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* ── Register Table ── */}
      {/* Strictly NO Status, NO Billing, NO Check-out */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/50 font-medium text-muted-foreground uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Stay Timeline</th>
                <th className="px-4 py-3">Room & Booking</th>
                <th className="px-4 py-3">Primary Guest</th>
                <th className="px-4 py-3">Contact & Details</th>
                <th className="px-4 py-3">Accompanying Occupants</th>
                <th className="px-4 py-3">Travel Data</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-muted-foreground"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-2">
                      <div className="rounded-full bg-muted p-3">
                        <GuestIcon className="size-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-foreground">
                        No Check-ins Found
                      </p>
                      <p className="text-xs text-muted-foreground">
                        There are no guest check-in records for{" "}
                        <span className="font-semibold text-foreground">
                          {data.formattedDate}
                        </span>
                        {search ? " matching your search criteria" : ""}.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const checkInFormatted = formatISTTime(entry.checkInTime);
                  const pGuest = entry.primaryGuest;
                  const accompanyingCount = entry.accompanyingGuests.length;

                  return (
                    <tr
                      key={entry.id}
                      className="transition-colors hover:bg-muted/40"
                    >
                      {/* Stay Timeline: Check-in Time ONLY (No Checkout) */}
                      <td className="px-4 py-3.5 align-top whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 rounded-md bg-primary-light px-2 py-1 font-semibold text-primary dark:bg-primary-subtle dark:text-primary">
                          <ClockIcon className="size-3.5 text-primary" />
                          <span>{checkInFormatted}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Check-in
                        </div>
                      </td>

                      {/* Room & Booking: Room #, Room Type, Reference, Booking Source */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center rounded-md bg-primary/10 px-2 py-0.5 font-bold text-primary">
                            Room {entry.roomNumber}
                          </span>
                          <span className="font-medium text-foreground">
                            {entry.roomTypeName}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px]">
                          <Link
                            href={`/bookings/${entry.id}`}
                            className="font-mono text-primary underline-offset-2 hover:underline"
                            title="View booking file"
                          >
                            {entry.reference}
                          </Link>
                          <span className="text-muted-foreground">•</span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] uppercase font-semibold tracking-wider"
                          >
                            {entry.source.replace("_", " ")}
                          </Badge>
                        </div>
                      </td>

                      {/* Guest Records: Primary Guest Name & Father's Name */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-semibold text-foreground text-sm">
                          {pGuest.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {pGuest.fatherName ? (
                            <span>
                              <span className="font-medium text-foreground/80">
                                S/o:
                              </span>{" "}
                              {pGuest.fatherName}
                            </span>
                          ) : (
                            <span className="italic">Father: Not listed</span>
                          )}
                        </div>
                      </td>

                      {/* Contact Number, Age & Gender */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-mono text-xs font-medium text-foreground">
                          {pGuest.mobile || "—"}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          {pGuest.age !== null && (
                            <span>{pGuest.age} yrs</span>
                          )}
                          {pGuest.age !== null && pGuest.sex && (
                            <span>•</span>
                          )}
                          {pGuest.sex && (
                            <span className="capitalize">
                              {pGuest.sex.toLowerCase()}
                            </span>
                          )}
                          {!pGuest.age && !pGuest.sex && (
                            <span className="italic">Details not provided</span>
                          )}
                        </div>
                      </td>

                      {/* Accompanying Occupants */}
                      <td className="px-4 py-3.5 align-top">
                        {accompanyingCount > 0 ? (
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedAccompanying({
                                  primaryName: pGuest.name,
                                  roomNumber: entry.roomNumber,
                                  reference: entry.reference,
                                  guests: entry.accompanyingGuests,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                            >
                              <GuestIcon className="size-3" />
                              <span>+{accompanyingCount} Occupant{accompanyingCount > 1 ? "s" : ""}</span>
                            </button>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                              {entry.accompanyingGuests.map((g) => g.name).join(", ")}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">
                            Solo Guest
                          </span>
                        )}
                      </td>

                      {/* Travel Data: Arriving From & Purpose of Visit */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-medium text-foreground">
                          {entry.arrivingFrom || "—"}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {entry.purposeOfVisit ? (
                            <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                              {entry.purposeOfVisit}
                            </span>
                          ) : (
                            <span className="italic">General Visit</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Accompanying Occupants Modal ── */}
      <Dialog
        open={Boolean(selectedAccompanying)}
        onOpenChange={(open) => {
          if (!open) setSelectedAccompanying(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <GuestIcon className="size-4 text-primary" />
              <span>Accompanying Occupants</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Room {selectedAccompanying?.roomNumber} • Booking Ref:{" "}
              {selectedAccompanying?.reference} (Primary Guest:{" "}
              {selectedAccompanying?.primaryName})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {selectedAccompanying?.guests.map((guest, idx) => (
              <div
                key={guest.id || idx}
                className="rounded-lg border bg-muted/30 p-3 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    {idx + 1}. {guest.name}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {guest.sex ? guest.sex.toLowerCase() : "Occupant"}
                    {guest.age ? `, ${guest.age}y` : ""}
                  </Badge>
                </div>

                {guest.fatherName && (
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-medium">Father&apos;s Name:</span>{" "}
                    {guest.fatherName}
                  </div>
                )}

                {guest.mobile && (
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-medium">Mobile:</span> {guest.mobile}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedAccompanying(null)}
              className="text-xs"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
