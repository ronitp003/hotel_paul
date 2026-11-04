import { z } from "zod";
import { type BookingSource, type Sex } from "@prisma/client";

export interface GuestInfo {
  id?: string;
  name: string;
  fatherName: string | null;
  age: number | null;
  sex: Sex | null;
  mobile: string | null;
}

export interface RegisterEntry {
  id: string;
  reference: string;
  checkInTime: string; // ISO string
  roomNumber: string;
  roomTypeName: string;
  primaryGuest: GuestInfo;
  accompanyingGuests: GuestInfo[];
  arrivingFrom: string | null;
  purposeOfVisit: string | null;
  source: BookingSource;
}

export interface RegisterDayData {
  date: string; // "YYYY-MM-DD" in IST
  formattedDate: string; // e.g. "Saturday, 31 October 2026"
  totalCheckIns: number;
  totalGuests: number;
  entries: RegisterEntry[];
}

export interface AnalyticsSummary {
  totalCheckIns: number;
  totalGuests: number;
  avgDailyCheckIns: number;
  avgStayDuration?: number;
  occupancyRate: number;
  totalRevenue?: number;
  topOrigin: string | null;
  topPurpose: string | null;
}

export interface AnalyticsWeekdayCheckIn {
  day: string;
  shortDay: string;
  count: number;
}

export interface AnalyticsDailyCheckIn {
  date: string;
  label: string;
  dayOfWeek: string;
  checkIns: number;
  guests: number;
}

export interface AnalyticsOccupancyDay {
  date: string;
  label: string;
  occupancyPercent: number;
  occupiedRooms: number;
  totalRooms: number;
}

export interface AnalyticsCategoryItem {
  name: string;
  count: number;
  percentage: number;
}

export interface CheckInTimeSlot {
  slot: "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";
  label: string;
  timeRange: string;
  count: number;
  percentage: number;
}

export interface PaymentCollectionItem {
  key: string;
  label: string;
  grossPayments: number;
  refunds: number;
  netCollections: number;
}

export interface AnalyticsPaymentCollections {
  daily: PaymentCollectionItem[];
  weekly: PaymentCollectionItem[];
  totalGrossPayments: number;
  totalRefunds: number;
  totalNetCollections: number;
}

export interface AnalyticsData {
  range: "7d" | "14d" | "30d" | "month";
  startDate: string;
  endDate: string;
  summary: AnalyticsSummary;
  dailyCheckIns: AnalyticsDailyCheckIn[];
  occupancyTrend: AnalyticsOccupancyDay[];
  checkInTimeDistribution: CheckInTimeSlot[];
  paymentCollections: AnalyticsPaymentCollections;
  weekdayCheckIns?: AnalyticsWeekdayCheckIn[];
  origins: AnalyticsCategoryItem[];
  purposes: AnalyticsCategoryItem[];
  sources: AnalyticsCategoryItem[];
}

export const registerFilterSchema = z.object({
  date: z.string().optional(),
  search: z.string().optional(),
  roomId: z.string().optional(),
});
