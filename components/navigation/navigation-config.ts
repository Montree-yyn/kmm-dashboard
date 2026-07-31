import {
  Banknote,
  BarChart3,
  ClipboardList,
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

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  visible: boolean;
};

export const navigationItems: NavigationItem[] = [
  { label: "Home", href: "/", icon: Home, visible: false },
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    visible: true,
  },
  { label: "Sales", href: "/sales", icon: Banknote, visible: true },
  {
    label: "Booking",
    href: "/booking",
    icon: ClipboardList,
    visible: true,
  },
  { label: "Stock", href: "/stock", icon: Tractor, visible: true },
  { label: "Customer", href: "/customer", icon: Users, visible: false },
  {
    label: "Marketing",
    href: "/marketing",
    icon: Megaphone,
    visible: true,
  },
  { label: "Report", href: "/report", icon: BarChart3, visible: false },
  { label: "AI", href: "/ai", icon: Sparkles, visible: false },
  { label: "Team", href: "/team", icon: Users, visible: true },
  { label: "Expense", href: "/expense", icon: Gauge, visible: true },
  { label: "Settings", href: "/settings", icon: Settings, visible: true },
];

export const visibleNavigationItems = navigationItems.filter(
  (item) => item.visible,
);

export function navigationItemIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
