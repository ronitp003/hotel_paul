import { z } from "zod";

export interface DashboardRoomCounts {
  total: number;
  occupied: number;
  available: number;
  reserved: number;
  maintenance: number;
  problems: number;
}

export interface DashboardTodayMovements {
  arrivals: {
    total: number;
    checkedIn: number;
    expected: number;
  };
  departures: {
    total: number;
    checkedOut: number;
    pending: number;
  };
}

export interface DashboardPaymentsDue {
  count: number;
  totalAmount: number;
}

export interface DashboardMonthlyBilling {
  invoicesCount: number;
  totalBilled: number;
  totalGst: number;
  monthName: string;
}

import { type BookingStatus } from "@prisma/client";

export interface TodayGuestMovement {
  id: string;
  reference: string;
  guestName: string;
  guestMobile: string | null;
  roomNumber: string;
  roomTypeName: string;
  time: string; // ISO string
  status: BookingStatus;
  balanceDue: number;
}

export interface DashboardSummary {
  rooms: DashboardRoomCounts;
  movements: DashboardTodayMovements;
  paymentsDue: DashboardPaymentsDue;
  billing: DashboardMonthlyBilling;
  arrivingToday: TodayGuestMovement[];
  departingToday: TodayGuestMovement[];
}

export const dashboardSummarySchema = z.object({
  rooms: z.object({
    total: z.number(),
    occupied: z.number(),
    available: z.number(),
    reserved: z.number(),
    maintenance: z.number(),
    problems: z.number(),
  }),
  movements: z.object({
    arrivals: z.object({
      total: z.number(),
      checkedIn: z.number(),
      expected: z.number(),
    }),
    departures: z.object({
      total: z.number(),
      checkedOut: z.number(),
      pending: z.number(),
    }),
  }),
  paymentsDue: z.object({
    count: z.number(),
    totalAmount: z.number(),
  }),
  billing: z.object({
    invoicesCount: z.number(),
    totalBilled: z.number(),
    totalGst: z.number(),
    monthName: z.string(),
  }),
});
