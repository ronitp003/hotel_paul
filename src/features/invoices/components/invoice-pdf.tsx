import React from "react";
import path from "path";
import fs from "fs";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { InvoiceSnapshot } from "@/server/services/invoice.service";
import { formatINRPlain } from "@/lib/money";
import { formatISTDateTime, formatISTDate } from "@/lib/datetime";

// Register custom TrueType font for clean Unicode rendering (specifically the Indian Rupee ₹ symbol)
const fontDir = path.join(process.cwd(), "public/fonts");
const hasCustomFont =
  fs.existsSync(path.join(fontDir, "DejaVuSans.ttf")) &&
  fs.existsSync(path.join(fontDir, "DejaVuSans-Bold.ttf"));

if (hasCustomFont) {
  Font.register({
    family: "DejaVuSans",
    fonts: [
      {
        src: path.join(fontDir, "DejaVuSans.ttf"),
        fontWeight: "normal",
      },
      {
        src: path.join(fontDir, "DejaVuSans-Bold.ttf"),
        fontWeight: "bold",
      },
      ...(fs.existsSync(path.join(fontDir, "DejaVuSans-Oblique.ttf"))
        ? [
            {
              src: path.join(fontDir, "DejaVuSans-Oblique.ttf"),
              fontStyle: "italic" as const,
            },
          ]
        : []),
    ],
  });
}

const fontBase = hasCustomFont ? "DejaVuSans" : "Helvetica";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: fontBase,
    fontSize: 9,
    color: "#1F2937",
    backgroundColor: "#FFFFFF",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1.5,
    borderBottomColor: "#0F766E",
    paddingBottom: 14,
    marginBottom: 14,
  },
  hotelBlock: {
    maxWidth: "60%",
  },
  hotelTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F766E",
    marginBottom: 4,
  },
  hotelSubtitle: {
    fontSize: 8,
    color: "#4B5563",
    lineHeight: 1.3,
  },
  invoiceMetaBlock: {
    textAlign: "right",
    alignItems: "flex-end",
  },
  invoiceTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  invoiceBadge: {
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#0F766E",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: 4,
  },
  invoiceBadgeText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0F766E",
  },
  metaText: {
    fontSize: 8,
    color: "#4B5563",
    marginBottom: 2,
  },
  twoColSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  boxContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#F9FAFB",
  },
  boxHeader: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0F766E",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 4,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  boxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  label: {
    fontSize: 8,
    color: "#6B7280",
  },
  value: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111827",
  },
  table: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    marginBottom: 14,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#0F766E",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCol: {
    fontWeight: "bold",
    fontSize: 8,
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F3F4F6",
  },
  tableRowEven: {
    backgroundColor: "#F9FAFB",
  },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: "center" },
  colRate: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },

  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 16,
  },
  leftNotesCol: {
    flex: 5,
  },
  totalsCol: {
    flex: 4.5,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#FAFAFA",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2.5,
    fontSize: 8,
  },
  totalLabel: {
    fontSize: 8,
    color: "#4B5563",
    flex: 1,
  },
  totalValue: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
    width: 90,
  },
  totalRowGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1.5,
    borderTopColor: "#0F766E",
    paddingTop: 6,
    marginTop: 6,
    marginBottom: 2,
  },
  grandLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0F766E",
    flex: 1,
  },
  grandValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0F766E",
    textAlign: "right",
    width: 90,
  },
  wordsBox: {
    backgroundColor: "#F0FDFA",
    borderWidth: 0.5,
    borderColor: "#0F766E",
    borderRadius: 4,
    padding: 6,
    marginBottom: 10,
  },
  wordsLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#0F766E",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  wordsText: {
    fontSize: 8,
    fontStyle: "italic",
    color: "#111827",
  },
  termsBox: {
    padding: 6,
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  termsLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  termsText: {
    fontSize: 7,
    color: "#6B7280",
    lineHeight: 1.3,
  },
  footerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
  },
  signatoryBlock: {
    alignItems: "center",
    width: 140,
  },
  signatoryLine: {
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    marginBottom: 4,
  },
  signatoryText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
  },
});

export function InvoicePdfDocument({
  snapshot,
}: {
  snapshot: InvoiceSnapshot;
}) {
  const primaryGuest = snapshot.guests.find((g) => g.isPrimary) ||
    snapshot.guests[0] || { name: "Guest" };

  const hotelName =
    snapshot.hotel.name === "Hotel Paul Updated"
      ? "Hotel Paul"
      : snapshot.hotel.name || "Hotel Paul";

  return (
    <Document
      title={`Invoice-${snapshot.invoice.displayNo}`}
      author={hotelName}
    >
      <Page size="A4" style={styles.page}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.hotelBlock}>
            <Text style={styles.hotelTitle}>{hotelName}</Text>
            <Text style={styles.hotelSubtitle}>{snapshot.hotel.address}</Text>
            <Text style={styles.hotelSubtitle}>
              Phone: {snapshot.hotel.phone}
            </Text>
            <Text style={styles.hotelSubtitle}>
              GSTIN: {snapshot.hotel.gstin}
            </Text>
          </View>
          <View style={styles.invoiceMetaBlock}>
            <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
            <View style={styles.invoiceBadge}>
              <Text style={styles.invoiceBadgeText}>
                {snapshot.invoice.displayNo}
              </Text>
            </View>
            <Text style={styles.metaText}>
              Date: {formatISTDate(snapshot.invoice.issuedAt)}
            </Text>
            <Text style={styles.metaText}>
              Booking Ref: {snapshot.booking.reference}
            </Text>
          </View>
        </View>

        {/* 2-Column Info: Guest Info & Stay Details */}
        <View style={styles.twoColSection}>
          {/* Guest Block */}
          <View style={styles.boxContainer}>
            <Text style={styles.boxHeader}>Guest Information</Text>
            <View style={styles.boxRow}>
              <Text style={styles.label}>Guest Name:</Text>
              <Text style={styles.value}>{primaryGuest.name}</Text>
            </View>
            {primaryGuest.mobile && (
              <View style={styles.boxRow}>
                <Text style={styles.label}>Mobile:</Text>
                <Text style={styles.value}>{primaryGuest.mobile}</Text>
              </View>
            )}
            {snapshot.guests.length > 1 && (
              <View style={styles.boxRow}>
                <Text style={styles.label}>Total Guests:</Text>
                <Text style={styles.value}>
                  {snapshot.guests.length} person(s)
                </Text>
              </View>
            )}
            {snapshot.booking.companyName && (
              <>
                <View style={styles.boxRow}>
                  <Text style={styles.label}>Company:</Text>
                  <Text style={styles.value}>
                    {snapshot.booking.companyName}
                  </Text>
                </View>
                {snapshot.booking.companyGstin && (
                  <View style={styles.boxRow}>
                    <Text style={styles.label}>Company GSTIN:</Text>
                    <Text style={styles.value}>
                      {snapshot.booking.companyGstin}
                    </Text>
                  </View>
                )}
                {snapshot.booking.companyAddress && (
                  <View style={styles.boxRow}>
                    <Text style={styles.label}>Company Address:</Text>
                    <Text style={styles.value}>
                      {snapshot.booking.companyAddress}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Stay Info */}
          <View style={styles.boxContainer}>
            <Text style={styles.boxHeader}>Stay & Room Details</Text>
            <View style={styles.boxRow}>
              <Text style={styles.label}>Room Number:</Text>
              <Text style={styles.value}>
                {snapshot.booking.roomNumber} ({snapshot.booking.roomTypeName})
              </Text>
            </View>
            <View style={styles.boxRow}>
              <Text style={styles.label}>Arrival:</Text>
              <Text style={styles.value}>
                {formatISTDateTime(
                  snapshot.booking.actualCheckInAt || snapshot.booking.checkInAt
                )}
              </Text>
            </View>
            <View style={styles.boxRow}>
              <Text style={styles.label}>Departure:</Text>
              <Text style={styles.value}>
                {formatISTDateTime(
                  snapshot.booking.actualCheckOutAt ||
                    snapshot.booking.checkOutAt
                )}
              </Text>
            </View>
            <View style={styles.boxRow}>
              <Text style={styles.label}>Billed Stay Days:</Text>
              <Text style={styles.value}>
                {snapshot.booking.stayDays} day(s)
              </Text>
            </View>
          </View>
        </View>

        {/* Itemized Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCol, styles.colDesc]}>
              Description
            </Text>
            <Text style={[styles.tableHeaderCol, styles.colQty]}>
              Days / Qty
            </Text>
            <Text style={[styles.tableHeaderCol, styles.colRate]}>
              Rate (₹)
            </Text>
            <Text style={[styles.tableHeaderCol, styles.colTotal]}>
              Amount (₹)
            </Text>
          </View>

          {/* Room Tariff Row */}
          <View style={styles.tableRow}>
            <Text style={styles.colDesc}>
              Room Accommodation (Room {snapshot.booking.roomNumber} -{" "}
              {snapshot.booking.roomTypeName})
            </Text>
            <Text style={styles.colQty}>{snapshot.booking.stayDays}</Text>
            <Text style={styles.colRate}>
              ₹{formatINRPlain(snapshot.booking.rateApplied)}
            </Text>
            <Text style={styles.colTotal}>
              ₹{formatINRPlain(snapshot.totals.roomCharges)}
            </Text>
          </View>

          {/* Additional Charges Rows */}
          {snapshot.charges.map((charge, idx) => (
            <View
              key={idx}
              style={[
                styles.tableRow,
                idx % 2 === 1 ? styles.tableRowEven : {},
              ]}
            >
              <Text style={styles.colDesc}>
                {charge.description}{" "}
                {charge.isTaxable ? "(Taxable Service)" : "(Non-Taxable)"}
              </Text>
              <Text style={styles.colQty}>1</Text>
              <Text style={styles.colRate}>
                ₹{formatINRPlain(charge.amount)}
              </Text>
              <Text style={styles.colTotal}>
                ₹{formatINRPlain(charge.amount)}
              </Text>
            </View>
          ))}

          {/* Discount Row (if any) */}
          {snapshot.totals.discount > 0 && (
            <View style={[styles.tableRow, { backgroundColor: "#FEF2F2" }]}>
              <Text
                style={[
                  styles.colDesc,
                  { color: "#B91C1C", fontWeight: "bold" },
                ]}
              >
                Discount Applied
              </Text>
              <Text style={styles.colQty}>—</Text>
              <Text style={styles.colRate}>—</Text>
              <Text
                style={[
                  styles.colTotal,
                  { color: "#B91C1C", fontWeight: "bold" },
                ]}
              >
                -₹{formatINRPlain(snapshot.totals.discount)}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Section: Words & Notes on Left, Totals Box on Right */}
        <View style={styles.bottomSection}>
          <View style={styles.leftNotesCol}>
            {/* Amount in Words */}
            <View style={styles.wordsBox}>
              <Text style={styles.wordsLabel}>Amount in Words (INR)</Text>
              <Text style={styles.wordsText}>
                {snapshot.totals.amountInWords}
              </Text>
            </View>

            {/* Terms & Conditions */}
            <View style={styles.termsBox}>
              <Text style={styles.termsLabel}>Notes & Instructions</Text>
              <Text style={styles.termsText}>
                {snapshot.hotel.invoiceNotes ||
                  "Goods once sold or services rendered will not be refunded. This invoice is generated electronically and is valid without physical seal."}
              </Text>
            </View>
          </View>

          {/* Totals Breakdown */}
          <View style={styles.totalsCol}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Taxable Value:</Text>
              <Text style={styles.totalValue}>
                ₹{formatINRPlain(snapshot.totals.taxableAmount)}
              </Text>
            </View>

            {snapshot.totals.nonTaxableChargesTotal > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Non-Taxable Services:</Text>
                <Text style={styles.totalValue}>
                  ₹{formatINRPlain(snapshot.totals.nonTaxableChargesTotal)}
                </Text>
              </View>
            )}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                CGST ({snapshot.totals.gstPercent / 2}%):
              </Text>
              <Text style={styles.totalValue}>
                ₹{formatINRPlain(snapshot.totals.cgst)}
              </Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                SGST ({snapshot.totals.gstPercent / 2}%):
              </Text>
              <Text style={styles.totalValue}>
                ₹{formatINRPlain(snapshot.totals.sgst)}
              </Text>
            </View>

            {snapshot.totals.roundOff !== 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Round-Off:</Text>
                <Text style={styles.totalValue}>
                  {snapshot.totals.roundOff < 0
                    ? `-₹${formatINRPlain(Math.abs(snapshot.totals.roundOff))}`
                    : `₹${formatINRPlain(snapshot.totals.roundOff)}`}
                </Text>
              </View>
            )}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Advance Paid:</Text>
              <Text style={styles.totalValue}>
                ₹{formatINRPlain(snapshot.totals.advancePaid)}
              </Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Settlement Payments:</Text>
              <Text style={styles.totalValue}>
                ₹{formatINRPlain(snapshot.totals.subsequentPaid || 0)}
              </Text>
            </View>

            {snapshot.totals.refundsTotal > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Refunds Issued:</Text>
                <Text style={styles.totalValue}>
                  -₹{formatINRPlain(snapshot.totals.refundsTotal)}
                </Text>
              </View>
            )}

            <View style={styles.totalRowGrand}>
              <Text style={styles.grandLabel}>Total Bill Amount:</Text>
              <Text style={styles.grandValue}>
                ₹{formatINRPlain(snapshot.totals.billAmount)}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer & Signatory */}
        <View style={styles.footerSection}>
          <View>
            <Text style={{ fontSize: 7, color: "#9CA3AF" }}>
              Issued by: {snapshot.invoice.issuedByName}
            </Text>
            <Text style={{ fontSize: 7, color: "#9CA3AF" }}>
              Generated on {formatISTDateTime(snapshot.invoice.issuedAt)}
            </Text>
          </View>
          <View style={styles.signatoryBlock}>
            <View style={styles.signatoryLine} />
            <Text style={styles.signatoryText}>Authorized Signatory</Text>
            <Text style={{ fontSize: 7, color: "#6B7280" }}>
              for {hotelName}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
