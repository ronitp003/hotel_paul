import { z } from "zod";
import { type BookingStatus } from "@prisma/client";
import type { RoomWithStatus } from "@/server/services/room.service";

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

export interface DashboardLowStockAlert {
  count: number;
  items: Array<{
    id: string;
    name: string;
    unit: string;
    qtyStore: number;
    reorderLevel: number;
  }>;
}

export interface ForecastDay {
  date: string; // ISO format "YYYY-MM-DD"
  label: string; // e.g. "Today (30 Oct)", "Tomorrow (31 Oct)", "01 Nov"
  dayOfWeek: string; // "Fri", "Sat", "Sun"
  booked: number;
  maintenance: number;
  available: number;
  totalRooms: number;
  occupancyPercent: number;
}

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
  roomList?: RoomWithStatus[];
  movements: DashboardTodayMovements;
  paymentsDue: DashboardPaymentsDue;
  billing: DashboardMonthlyBilling | null;
  lowStock: DashboardLowStockAlert;
  forecast: ForecastDay[];
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
  billing: z
    .object({
      invoicesCount: z.number(),
      totalBilled: z.number(),
      totalGst: z.number(),
      monthName: z.string(),
    })
    .nullable(),
  lowStock: z.object({
    count: z.number(),
    items: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        unit: z.string(),
        qtyStore: z.number(),
        reorderLevel: z.number(),
      })
    ),
  }),
  forecast: z.array(
    z.object({
      date: z.string(),
      label: z.string(),
      dayOfWeek: z.string(),
      booked: z.number(),
      maintenance: z.number(),
      available: z.number(),
      totalRooms: z.number(),
      occupancyPercent: z.number(),
    })
  ),
});
