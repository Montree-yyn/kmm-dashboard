"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  Banknote,
  ClipboardList,
  Gauge,
  Home,
  LogOut,
  Megaphone,
  Settings,
  Tractor,
  Users,
  X,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { auth } from "../../lib/firebase";
import { cn } from "../../lib/utils";

const navItems: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Sales", href: "/sales", icon: Banknote },
  { label: "Booking", href: "/booking", icon: ClipboardList },
  { label: "Stock", href: "/stock", icon: Tractor },
  { label: "Marketing", href: "/marketing", icon: Megaphone },
  { label: "Expense", href: "/expense", icon: Gauge },
  { label: "Team", href: "/team", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings },
];

type AppSidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onMobileOpenChange: (open: boolean) => void;
};

export function AppSidebar({ collapsed, mobileOpen, onCollapsedChange, onMobileOpenChange }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await signOut(auth);
    router.replace("/login");
  }

  const sidebar = (
    <>
      <div className="flex h-[82px] items-center justify-between border-b border-[#ECEDEF] px-5">
        <img src="/kmm-logo.png" alt="Kubota Maesod Myanmar" className={cn("h-11 w-auto object-contain object-left transition-all", collapsed ? "max-w-10 object-[9%_center]" : "max-w-[128px]")} />
        <button className="hidden rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#F4F5F7] hover:text-[#55565A] lg:block" onClick={() => onCollapsedChange(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <ChevronDown className={cn("rotate-90 transition-transform", collapsed && "-rotate-90")} size={18} />
        </button>
        <button className="rounded-lg p-2 text-[#55565A] hover:bg-[#F4F5F7] lg:hidden" onClick={() => onMobileOpenChange(false)} aria-label="Close navigation"><X size={20} /></button>
      </div>
      <nav className="flex-1 space-y-1 p-3" aria-label="Primary navigation">
        {!collapsed && <p className="px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#A1A5AC]">KMM Sales Intelligence</p>}
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={() => onMobileOpenChange(false)} className={cn("group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all", active ? "bg-[#FFF1E3] text-[#E86F00]" : "text-[#606168] hover:bg-[#F6F7F8] hover:text-[#1F2937]", collapsed && "justify-center px-2")} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined}>
              <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
              {!collapsed && <span>{item.label}</span>}
              {active && !collapsed && <span className="ml-auto size-1.5 rounded-full bg-[#FF8615]" />}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[#ECEDEF] p-3">
        <button onClick={logout} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#606168] transition-colors hover:bg-[#FFF1E3] hover:text-[#D96500]", collapsed && "justify-center px-2")} title={collapsed ? "Logout" : undefined}>
          <LogOut size={19} />{!collapsed && "Logout"}
        </button>
        {!collapsed && (
          <div className="mt-3 rounded-xl bg-[#F8F9FA] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#55565A]"><span className="size-2 rounded-full bg-[#22C55E]" />Data connected</div>
            <p className="mt-1.5 text-[11px] leading-4 text-[#8A8E96]">5 source files · H1 complete</p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[#E5E7EB] bg-white transition-[width] duration-300 lg:flex", collapsed ? "w-[76px]" : "w-[240px]")}>{sidebar}</aside>
      {mobileOpen && <button className="fixed inset-0 z-40 bg-[#1F2937]/35 backdrop-blur-[2px] lg:hidden" aria-label="Close navigation overlay" onClick={() => onMobileOpenChange(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-white shadow-2xl transition-transform duration-300 lg:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}>{sidebar}</aside>
    </>
  );
}
