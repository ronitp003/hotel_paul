import { describe, it, expect } from "vitest";
import { generateRegisterCsv, formatCsvCell } from "@/features/register/export-csv";
import { RegisterEntry } from "@/features/register/schemas";
import { BookingSource, Sex } from "@prisma/client";

describe("Check-in Register CSV Export", () => {
  describe("formatCsvCell", () => {
    it("quotes standard strings", () => {
      expect(formatCsvCell("Standard Non-AC")).toBe('"Standard Non-AC"');
    });

    it("escapes quotes inside values per RFC-4180", () => {
      expect(formatCsvCell('John "The Boss"')).toBe('"John ""The Boss"""');
    });

    it("handles null and undefined as empty quoted string", () => {
      expect(formatCsvCell(null)).toBe('""');
      expect(formatCsvCell(undefined)).toBe('""');
    });

    it("handles numbers including zero", () => {
      expect(formatCsvCell(0)).toBe('"0"');
      expect(formatCsvCell(25)).toBe('"25"');
    });
  });

  describe("generateRegisterCsv", () => {
    const baseHeaders = [
      "Check-in Date & Time",
      "Room Number",
      "Room Type",
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

    it("exports standard 13 columns without Booking Reference when no bookings have accompanying guests", () => {
      const entries: RegisterEntry[] = [
        {
          id: "bk-1",
          reference: "BK-20261103-001",
          checkInTime: "2026-11-03T10:30:00.000Z",
          roomNumber: "101",
          roomTypeName: "Standard Non-AC",
          source: BookingSource.WALK_IN,
          primaryGuest: {
            name: "Jayanta",
            fatherName: "bbbusa",
            mobile: "1234567891",
            age: 21,
            sex: Sex.MALE,
          },
          accompanyingGuests: [],
          arrivingFrom: "Mumbai",
          purposeOfVisit: "Tour",
        },
      ];

      const csv = generateRegisterCsv(entries);
      const lines = csv.split("\n");

      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe(baseHeaders.join(","));

      const dataRow = lines[1];
      expect(dataRow).toContain('"101"');
      expect(dataRow).not.toContain('"BK-20261103-001"'); // Booking Reference removed
      expect(dataRow).toContain('"WALK_IN"');
      expect(dataRow).toContain('"Jayanta"');
      expect(dataRow).toContain('"bbbusa"');
      expect(dataRow).toContain('"1234567891"');
      expect(dataRow).toContain('"21"');
      expect(dataRow).toContain('"MALE"');
      expect(dataRow).toContain('"0"'); // Occupants count
      expect(dataRow).toContain('"Mumbai"');
      expect(dataRow).toContain('"Tour"');

      // 13 columns total (Booking reference removed)
      const columns = dataRow.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      expect(columns.length).toBe(13);
      // Arriving From and Purpose of Visit are the last columns
      expect(columns[columns.length - 2]).toBe('"Mumbai"');
      expect(columns[columns.length - 1]).toBe('"Tour"');
    });

    it("dynamically appends accompanying guest columns including phone number, with arriving from & purpose at last column", () => {
      const entries: RegisterEntry[] = [
        // Entry 1: 1 accompanying guest
        {
          id: "bk-1",
          reference: "BK-20261103-001",
          checkInTime: "2026-11-03T01:39:00.000Z",
          roomNumber: "102",
          roomTypeName: "Standard Non-AC",
          source: BookingSource.PHONE,
          primaryGuest: {
            name: "RANDOM PERSON",
            fatherName: null,
            mobile: "9876543210",
            age: 33,
            sex: Sex.MALE,
          },
          accompanyingGuests: [
            {
              name: "RANDOM PERSON 2",
              fatherName: "Senior Person",
              age: 28,
              sex: Sex.FEMALE,
              mobile: "9988776655",
            },
          ],
          arrivingFrom: "Kolkata",
          purposeOfVisit: "BUSINESS",
        },
        // Entry 2: 2 accompanying guests (the max across this report)
        {
          id: "bk-2",
          reference: "BK-20261103-002",
          checkInTime: "2026-11-03T05:00:00.000Z",
          roomNumber: "103",
          roomTypeName: "Deluxe AC",
          source: BookingSource.WALK_IN,
          primaryGuest: {
            name: "Alice Smith",
            fatherName: "Bob Smith",
            mobile: "9123456780",
            age: 40,
            sex: Sex.FEMALE,
          },
          accompanyingGuests: [
            {
              name: "Charlie Smith",
              fatherName: "Bob Smith",
              age: 15,
              sex: Sex.MALE,
              mobile: "9811122233",
            },
            {
              name: "Daisy Smith",
              fatherName: "Bob Smith",
              age: 12,
              sex: Sex.FEMALE,
              mobile: null,
            },
          ],
          arrivingFrom: "Delhi",
          purposeOfVisit: "VACATION",
        },
        // Entry 3: 0 accompanying guests
        {
          id: "bk-3",
          reference: "BK-20261103-003",
          checkInTime: "2026-11-03T10:10:00.000Z",
          roomNumber: "101",
          roomTypeName: "Standard Non-AC",
          source: BookingSource.WALK_IN,
          primaryGuest: {
            name: "HGFDX",
            fatherName: null,
            mobile: "1234567891",
            age: 56,
            sex: Sex.MALE,
          },
          accompanyingGuests: [],
          arrivingFrom: "RDVF",
          purposeOfVisit: "FXAB FDF",
        },
      ];

      const csv = generateRegisterCsv(entries);
      const lines = csv.split("\n");

      // Verify header contains dynamic columns for Guest 1 and Guest 2, with Arriving From & Purpose of Visit at the end
      const expectedHeader = [
        "Check-in Date & Time",
        "Room Number",
        "Room Type",
        "Booking Source",
        "Primary Guest Name",
        "Father's Name",
        "Mobile Contact",
        "Age",
        "Sex",
        "Accompanying Occupants Count",
        "Accompanying Names",
        "Accompanying Guest 1 – Name",
        "Accompanying Guest 1 – Phone Number",
        "Accompanying Guest 1 – Sex",
        "Accompanying Guest 1 – Age",
        "Accompanying Guest 1 – Father's Name",
        "Accompanying Guest 2 – Name",
        "Accompanying Guest 2 – Phone Number",
        "Accompanying Guest 2 – Sex",
        "Accompanying Guest 2 – Age",
        "Accompanying Guest 2 – Father's Name",
        "Arriving From",
        "Purpose of Visit",
      ].join(",");

      expect(lines[0]).toBe(expectedHeader);

      // Total columns: 11 base + (2 * 5) + 2 travel = 23
      // Entry 1 row: Has Guest 1 filled with phone number, Guest 2 empty, travel at the end
      const row1 = lines[1];
      expect(row1).toContain('"RANDOM PERSON 2","9988776655","FEMALE","28","Senior Person"');
      expect(row1).toMatch(/,"","","","","","Kolkata","BUSINESS"$/); // Guest 2 is empty, ends with travel info

      // Entry 2 row: Has Guest 1 and Guest 2 filled (Guest 2 mobile is null -> "")
      const row2 = lines[2];
      expect(row2).toContain('"Charlie Smith","9811122233","MALE","15","Bob Smith"');
      expect(row2).toContain('"Daisy Smith","","FEMALE","12","Bob Smith"');
      expect(row2).toMatch(/,"Delhi","VACATION"$/);

      // Entry 3 row: Has 0 guests, so Guest 1 and Guest 2 are both empty (10 empty fields)
      const row3 = lines[3];
      expect(row3).toContain('"HGFDX"');
      expect(row3).toMatch(/,"","","","","","","","","","","RDVF","FXAB FDF"$/); // 10 empty slots for 2 missing guests, ends with travel info
    });

    it("leaves optional fields empty when information is unavailable", () => {
      const entries: RegisterEntry[] = [
        {
          id: "bk-1",
          reference: "BK-20261103-001",
          checkInTime: "2026-11-03T01:39:00.000Z",
          roomNumber: "102",
          roomTypeName: "Standard Non-AC",
          source: BookingSource.PHONE,
          primaryGuest: {
            name: "Primary",
            fatherName: null,
            mobile: null,
            age: null,
            sex: null,
          },
          accompanyingGuests: [
            {
              name: "Accompanying Person",
              fatherName: null,
              age: null,
              sex: null,
              mobile: null,
            },
          ],
          arrivingFrom: null,
          purposeOfVisit: null,
        },
      ];

      const csv = generateRegisterCsv(entries);
      const lines = csv.split("\n");
      const row = lines[1];

      // Accompanying guest columns should be: "Accompanying Person","","","",""
      expect(row).toContain('"Accompanying Person","","","",""');
      expect(row).toMatch(/,"",""$/); // Arriving from and purpose null -> "",""
    });

    it("returns base headers only when entries is empty", () => {
      const csv = generateRegisterCsv([]);
      expect(csv).toBe(baseHeaders.join(","));
    });
  });
});

