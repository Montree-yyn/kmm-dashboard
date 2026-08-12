import {
  Banknote,
  BarChart3,
  ClipboardList,
  CloudRain,
  Database,
  Gauge,
  Home,
  LayoutDashboard,
  Megaphone,
  Settings,
  Sparkles,
  Tractor,
  Users,
  type LucideIcon,
} from "lucide-react";
import { DAILY_MANAGEMENT_REPORT_ENABLED } from "../../lib/features";
import type { LocaleKey } from "../../src/locales";

export type NavigationItem = {
  label: string;
  labelKey?: LocaleKey;
  href: string;
  icon: LucideIcon;
  visible: boolean;
};

export const navigationItems: NavigationItem[] = [
  { label: "Home", href: "/", icon: Home, visible: false },
  {
    label: "Dashboard",
    labelKey: "nav.dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    visible: true,
  },
  {
    label: "Daily Report",
    labelKey: "nav.dailyReport",
    href: "/daily-management",
    icon: BarChart3,
    visible: DAILY_MANAGEMENT_REPORT_ENABLED,
  },
  { label: "Sales", labelKey: "nav.sales", href: "/sales", icon: Banknote, visible: true },
  {
    label: "Booking",
    labelKey: "nav.booking",
    href: "/booking",
    icon: ClipboardList,
    visible: true,
  },
  { label: "Stock", labelKey: "nav.stock", href: "/stock", icon: Tractor, visible: true },
  { label: "Customer", href: "/customer", icon: Users, visible: false },
  {
    label: "Marketing",
    labelKey: "nav.marketing",
    href: "/marketing",
    icon: Megaphone,
    visible: true,
  },
  {
    label: "Weather",
    labelKey: "nav.weather",
    href: "/weather",
    icon: CloudRain,
    visible: true,
  },
  { label: "Report", href: "/report", icon: BarChart3, visible: false },
  { label: "AI", href: "/ai", icon: Sparkles, visible: false },
  { label: "Expense", labelKey: "nav.expense", href: "/expense", icon: Gauge, visible: true },
  { label: "Team", labelKey: "nav.team", href: "/team", icon: Users, visible: true },
  {
    label: "Data Hub",
    labelKey: "nav.dataHub",
    href: "/data-hub",
    icon: Database,
    visible: true,
  },
  { label: "Settings", labelKey: "nav.settings", href: "/settings", icon: Settings, visible: true },
];

export const visibleNavigationItems = navigationItems.filter(
  (item) => item.visible,
);

export function navigationItemIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
