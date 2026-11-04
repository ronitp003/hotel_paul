import { RegisterEntry } from "./schemas";
import { formatISTTime } from "@/lib/datetime";

/**
 * Formats a single value as an RFC-4180 compliant quoted CSV cell.
 */
export function formatCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Generates Check-in Register CSV content with dynamic columns
 * for each accompanying guest up to the maximum number in the exported entries.
 */
export function generateRegisterCsv(entries: RegisterEntry[]): string {
  const maxAccompanying = entries.reduce(
    (max, e) => Math.max(max, e.accompanyingGuests?.length || 0),
    0
  );

  const headers = [
    "Check-in Date & Time",
    "Room Number",
    "Room Type",
    "Booking Reference",
    "Booking Source",
    "Primary Guest Name",
    "Father's Name",
    "Mobile Contact",
    "Age",
    "Sex",
    "Accompanying Occupants Count",
    "Accompanying Names",
    "Arriving From",
    "Purpose of Visit",
  ];

  for (let i = 1; i <= maxAccompanying; i++) {
    headers.push(
      `Accompanying Guest ${i} – Name`,
      `Accompanying Guest ${i} – Sex`,
      `Accompanying Guest ${i} – Age`,
      `Accompanying Guest ${i} – Father's Name`
    );
  }

  const rows = entries.map((e) => {
    const row = [
      formatCsvCell(formatISTTime(e.checkInTime)),
      formatCsvCell(e.roomNumber),
      formatCsvCell(e.roomTypeName),
      formatCsvCell(e.reference),
      formatCsvCell(e.source),
      formatCsvCell(e.primaryGuest?.name ?? ""),
      formatCsvCell(e.primaryGuest?.fatherName || ""),
      formatCsvCell(e.primaryGuest?.mobile || ""),
      formatCsvCell(
        e.primaryGuest?.age !== null && e.primaryGuest?.age !== undefined
          ? e.primaryGuest.age
          : ""
      ),
      formatCsvCell(e.primaryGuest?.sex || ""),
      formatCsvCell(e.accompanyingGuests?.length || 0),
      formatCsvCell(
        (e.accompanyingGuests || []).map((g) => g.name).join("; ")
      ),
      formatCsvCell(e.arrivingFrom || ""),
      formatCsvCell(e.purposeOfVisit || ""),
    ];

    for (let i = 0; i < maxAccompanying; i++) {
      const guest = e.accompanyingGuests?.[i];
      if (guest) {
        row.push(
          formatCsvCell(guest.name || ""),
          formatCsvCell(guest.sex || ""),
          formatCsvCell(
            guest.age !== null && guest.age !== undefined ? guest.age : ""
          ),
          formatCsvCell(guest.fatherName || "")
        );
      } else {
        row.push(
          formatCsvCell(""),
          formatCsvCell(""),
          formatCsvCell(""),
          formatCsvCell("")
        );
      }
    }

    return row.join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

