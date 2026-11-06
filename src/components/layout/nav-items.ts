import type { IconType } from "react-icons";
import {
  DashboardIcon,
  RoomIcon,
  CalendarIcon,
  GuestIcon,
  PaymentIcon,
  ReportIcon,
  AnalyticsIcon,
  InventoryIcon,
  SettingsIcon,
  UserIcon,
} from "@/lib/icons";
import { ROLES, type Role } from "@/lib/constants";

export interface NavItem {
  title: string;
  href: string;
  icon: IconType;
  roles: Role[];
  highlight?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: DashboardIcon,
    roles: [ROLES.OWNER, ROLES.RECEPTIONIST],
  },
  {
    title: "Rooms",
    href: "/rooms",
    icon: RoomIcon,
    roles: [ROLES.OWNER, ROLES.RECEPTIONIST],
  },
  {
    title: "Calendar",
    href: "/calendar",
    icon: CalendarIcon,
    roles: [ROLES.OWNER, ROLES.RECEPTIONIST],
  },
  {
    title: "Bookings",
    href: "/bookings",
    icon: GuestIcon,
    roles: [ROLES.OWNER, ROLES.RECEPTIONIST],
  },
  {
    title: "Payments & Invoices",
    href: "/payments",
    icon: PaymentIcon,
    roles: [ROLES.OWNER, ROLES.RECEPTIONIST],
  },
  {
    title: "Daily Report",
    href: "/register",
    icon: ReportIcon,
    roles: [ROLES.OWNER],
  },
  {
    title: "Analytics",
    href: "/register?tab=analytics",
    icon: AnalyticsIcon,
    roles: [ROLES.OWNER],
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: InventoryIcon,
    roles: [ROLES.OWNER, ROLES.RECEPTIONIST],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: SettingsIcon,
    roles: [ROLES.OWNER],
  },
  {
    title: "Profile",
    href: "/profile",
    icon: UserIcon,
    roles: [ROLES.OWNER, ROLES.RECEPTIONIST],
  },
];
