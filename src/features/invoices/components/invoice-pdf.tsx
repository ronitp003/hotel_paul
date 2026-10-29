import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { InvoiceSnapshot } from "@/server/services/invoice.service";
import { formatINRPlain } from "@/lib/money";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "Helvetica",
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
    fontFamily: "Helvetica-Bold",
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
    fontFamily: "Helvetica-Bold",
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
    fontFamily: "Helvetica-Bold",
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
    fontFamily: "Helvetica-Bold",
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
    fontFamily: "Helvetica-Bold",
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
    fontFamily: "Helvetica-Bold",
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
    flex: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#FAFAFA",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    fontSize: 8,
  },
  totalRowGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1.5,
    borderTopColor: "#0F766E",
    paddingTop: 5,
    marginTop: 4,
    marginBottom: 4,
  },
  grandText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#0F766E",
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
    fontFamily: "Helvetica-Bold",
    color: "#0F766E",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  wordsText: {
    fontSize: 8,
    fontFamily: "Helvetica-Oblique",
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
    fontFamily: "Helvetica-Bold",
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
    fontFamily: "Helvetica-Bold",
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

  return (
    <Document
      title={`Invoice-${snapshot.invoice.displayNo}`}
      author="Hotel Paul"
    >
      <Page size="A4" style={styles.page}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.hotelBlock}>
            <Text style={styles.hotelTitle}>{snapshot.hotel.name}</Text>
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
              Date:{" "}
              {new Date(snapshot.invoice.issuedAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
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
                {new Date(
                  snapshot.booking.actualCheckInAt || snapshot.booking.checkInAt
                ).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
            <View style={styles.boxRow}>
              <Text style={styles.label}>Departure:</Text>
              <Text style={styles.value}>
                {new Date(
                  snapshot.booking.actualCheckOutAt ||
                    snapshot.booking.checkOutAt
                ).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
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
              {formatINRPlain(snapshot.booking.rateApplied)}
            </Text>
            <Text style={styles.colTotal}>
              {formatINRPlain(snapshot.totals.roomCharges)}
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
                {formatINRPlain(charge.amount)}
              </Text>
              <Text style={styles.colTotal}>
                {formatINRPlain(charge.amount)}
              </Text>
            </View>
          ))}

          {/* Discount Row (if any) */}
          {snapshot.totals.discount > 0 && (
            <View style={[styles.tableRow, { backgroundColor: "#FEF2F2" }]}>
              <Text
                style={[
                  styles.colDesc,
                  { color: "#B91C1C", fontFamily: "Helvetica-Bold" },
                ]}
              >
                Discount Applied
              </Text>
              <Text style={styles.colQty}>—</Text>
              <Text style={styles.colRate}>—</Text>
              <Text
                style={[
                  styles.colTotal,
                  { color: "#B91C1C", fontFamily: "Helvetica-Bold" },
                ]}
              >
                -{formatINRPlain(snapshot.totals.discount)}
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
              <Text style={styles.label}>Taxable Value:</Text>
              <Text style={styles.value}>
                ₹{formatINRPlain(snapshot.totals.taxableAmount)}
              </Text>
            </View>

            {snapshot.totals.nonTaxableChargesTotal > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.label}>Non-Taxable Services:</Text>
                <Text style={styles.value}>
                  ₹{formatINRPlain(snapshot.totals.nonTaxableChargesTotal)}
                </Text>
              </View>
            )}

            <View style={styles.totalRow}>
              <Text style={styles.label}>
                CGST ({snapshot.totals.gstPercent / 2}%):
              </Text>
              <Text style={styles.value}>
                ₹{formatINRPlain(snapshot.totals.cgst)}
              </Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.label}>
                SGST ({snapshot.totals.gstPercent / 2}%):
              </Text>
              <Text style={styles.value}>
                ₹{formatINRPlain(snapshot.totals.sgst)}
              </Text>
            </View>

            {snapshot.totals.roundOff !== 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.label}>Round-Off:</Text>
                <Text style={styles.value}>
                  ₹{formatINRPlain(snapshot.totals.roundOff)}
                </Text>
              </View>
            )}

            <View style={styles.totalRowGrand}>
              <Text style={styles.grandText}>Total Bill Amount:</Text>
              <Text style={styles.grandText}>
                ₹{formatINRPlain(snapshot.totals.billAmount)}
              </Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.label}>Advance Paid:</Text>
              <Text style={styles.value}>
                ₹{formatINRPlain(snapshot.totals.advancePaid)}
              </Text>
            </View>

            {snapshot.totals.subsequentPaid > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.label}>Settlement Payments:</Text>
                <Text style={styles.value}>
                  ₹{formatINRPlain(snapshot.totals.subsequentPaid)}
                </Text>
              </View>
            )}

            {snapshot.totals.refundsTotal > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.label}>Refunds Issued:</Text>
                <Text style={styles.value}>
                  -₹{formatINRPlain(snapshot.totals.refundsTotal)}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.totalRow,
                {
                  borderTopWidth: 0.5,
                  borderTopColor: "#E5E7EB",
                  paddingTop: 4,
                  marginTop: 2,
                },
              ]}
            >
              <Text
                style={[
                  styles.label,
                  { fontFamily: "Helvetica-Bold", color: "#111827" },
                ]}
              >
                Balance Due:
              </Text>
              <Text
                style={[
                  styles.value,
                  {
                    color:
                      snapshot.totals.balanceDue > 0 ? "#DC2626" : "#059669",
                    fontSize: 9,
                  },
                ]}
              >
                ₹{formatINRPlain(snapshot.totals.balanceDue)}
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
              Generated on{" "}
              {new Date(snapshot.invoice.issuedAt).toLocaleString("en-IN")}
            </Text>
          </View>
          <View style={styles.signatoryBlock}>
            <View style={styles.signatoryLine} />
            <Text style={styles.signatoryText}>Authorized Signatory</Text>
            <Text style={{ fontSize: 7, color: "#6B7280" }}>
              for {snapshot.hotel.name}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
