"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  FileText,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  Lightbulb,
  Menu,
  PackageSearch,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib/utils";

type ViewState = "ready" | "loading" | "empty" | "error";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const salesActual = [106, 69, 54, 19, 34, 27];
const salesPlan = [55, 55, 60, 50, 60, 55];

const navItems: { label: string; icon: LucideIcon; href: string }[] = [
  { label: "Overview", icon: LayoutDashboard, href: "#overview" },
  { label: "Sales", icon: TrendingUp, href: "#performance" },
  { label: "Bookings", icon: ClipboardCheck, href: "#bookings" },
  { label: "Revenue & GP", icon: CircleDollarSign, href: "#performance" },
  { label: "Inventory", icon: Boxes, href: "#inventory" },
  { label: "Branches", icon: Building2, href: "#branches" },
  { label: "H2 Action Plan", icon: Target, href: "#actions" },
];

const branches = [
  { name: "KMM03", sales: 189, booking: 169, stock: 154, revenue: "15.40B", action: "Protect momentum", tone: "success" },
  { name: "KMM02", sales: 102, booking: 83, stock: 282, revenue: "6.58B", action: "Diagnose stock gap", tone: "warning" },
  { name: "KMM01", sales: 18, booking: 14, stock: 169, revenue: "1.18B", action: "Rebuild pipeline", tone: "danger" },
];

const kpis = [
  {
    label: "Sales units",
    value: "309",
    context: "of 335 H1 plan",
    change: "92.2% achieved",
    direction: "down" as const,
    icon: ShoppingCart,
    progress: 92.2,
    spark: [28, 20, 16, 7, 11, 9],
  },
  {
    label: "Final received",
    value: "23.16B",
    suffix: "MMK",
    context: "of 49.45B plan",
    change: "47% achieved",
    direction: "down" as const,
    icon: CircleDollarSign,
    progress: 47,
    spark: [30, 19, 16, 5, 9, 12],
  },
  {
    label: "GP1",
    value: "2.05B",
    suffix: "MMK",
    context: "8.9% of final received",
    change: "Margin baseline",
    direction: "up" as const,
    icon: Gauge,
    progress: 89,
    spark: [29, 15, 14, 6, 9, 12],
  },
  {
    label: "Open bookings",
    value: "59",
    context: "of 266 H1 bookings",
    change: "74 cancelled",
    direction: "down" as const,
    icon: ClipboardCheck,
    progress: 50,
    spark: [22, 20, 10, 5, 15, 18],
  },
];

function Sparkline({ values }: { values: number[] }) {
  const points = values.map((v, i) => `${i * 15},${34 - v}`).join(" ");
  return (
    <svg aria-hidden="true" className="h-10 w-24 overflow-visible" viewBox="0 0 75 36">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#FF8615" stopOpacity="0.24" />
          <stop offset="1" stopColor="#FF8615" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill="url(#spark-fill)" points={`0,36 ${points} 75,36`} />
      <polyline fill="none" points={points} stroke="#FF8615" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      <circle cx="75" cy={34 - values[values.length - 1]} fill="#fff" r="2.7" stroke="#FF8615" strokeWidth="2" />
    </svg>
  );
}

function KpiCard({ item, index }: { item: (typeof kpis)[number]; index: number }) {
  const Icon = item.icon;
  const isPositive = item.direction === "up";
  return (
    <Card className="group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_34px_rgba(31,41,55,0.08)]">
      {index === 0 && <div className="absolute inset-x-0 top-0 h-1 bg-[#FF8615]" />}
      <div className="mb-5 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#FFF4E9] text-[#E86F00]">
            <Icon size={19} strokeWidth={1.9} />
          </span>
          <p className="text-sm font-semibold text-[#55565A]">{item.label}</p>
        </div>
        <button className="text-[#9CA3AF] transition-colors hover:text-[#55565A]" title={`About ${item.label}`} aria-label={`About ${item.label}`}>
          <HelpCircle size={17} />
        </button>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-[30px] font-bold tracking-[-0.04em] text-[#1F2937]">{item.value}</span>
            {item.suffix && <span className="text-xs font-semibold text-[#6B7280]">{item.suffix}</span>}
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">{item.context}</p>
        </div>
        <Sparkline values={item.spark} />
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-[#F0F1F3] pt-4">
        <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", isPositive ? "text-[#16A34A]" : "text-[#D97706]")}>
          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {item.change}
        </span>
        <span className="text-[11px] font-medium text-[#9CA3AF]">H1 2026</span>
      </div>
    </Card>
  );
}

function SalesChart() {
  const max = 120;
  return (
    <div className="mt-6">
      <div className="chart-grid relative flex h-[220px] items-end justify-around gap-2 border-b border-[#E5E7EB] px-2 sm:gap-5 sm:px-6">
        {months.map((month, i) => (
          <div key={month} className="relative z-10 flex h-full flex-1 items-end justify-center gap-1.5 sm:gap-2" title={`${month}: ${salesActual[i]} actual, ${salesPlan[i]} plan`}>
            <div className="relative w-[38%] min-w-3 max-w-7 rounded-t-md bg-[#FF8615] transition-opacity hover:opacity-80" style={{ height: `${(salesActual[i] / max) * 100}%` }}>
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-bold text-[#55565A]">{salesActual[i]}</span>
            </div>
            <div className="w-[38%] min-w-3 max-w-7 rounded-t-md bg-[#D7D9DD] transition-colors hover:bg-[#BABDC3]" style={{ height: `${(salesPlan[i] / max) * 100}%` }} />
            <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs font-medium text-[#6B7280]">{month}</span>
          </div>
        ))}
      </div>
      <div className="mt-9 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-5 text-xs font-medium text-[#6B7280]">
          <span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-[#FF8615]" />Actual</span>
          <span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-[#D7D9DD]" />Plan</span>
        </div>
        <p className="text-xs text-[#6B7280]"><strong className="text-[#1F2937]">–26 units</strong> to H1 plan</p>
      </div>
    </div>
  );
}

function RevenueChart() {
  const revenue = [7.9, 4.83, 4.11, 0.95, 2.31, 3.06];
  const gp = [0.77, 0.38, 0.34, 0.1, 0.18, 0.28];
  const x = (i: number) => 12 + i * 54;
  const ry = (v: number) => 180 - (v / 8.5) * 145;
  return (
    <div className="mt-6">
      <svg aria-label="Monthly final received and GP1 trend" className="h-[220px] w-full overflow-visible" viewBox="0 0 295 215" preserveAspectRatio="none" role="img">
        {[35, 83, 131, 179].map((y) => <line key={y} x1="0" x2="295" y1={y} y2={y} stroke="#ECEEF1" strokeDasharray="3 4" />)}
        <polyline fill="none" points={revenue.map((v, i) => `${x(i)},${ry(v)}`).join(" ")} stroke="#FF8615" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        <polyline fill="none" points={gp.map((v, i) => `${x(i)},${ry(v)}`).join(" ")} stroke="#55565A" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        {revenue.map((v, i) => <circle key={`r-${i}`} cx={x(i)} cy={ry(v)} fill="#fff" r="4" stroke="#FF8615" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />)}
        {gp.map((v, i) => <circle key={`g-${i}`} cx={x(i)} cy={ry(v)} fill="#fff" r="3.5" stroke="#55565A" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
        {months.map((month, i) => <text key={month} x={x(i)} y="207" textAnchor="middle" fill="#6B7280" fontSize="11">{month}</text>)}
      </svg>
      <div className="mt-1 flex items-center gap-5 text-xs font-medium text-[#6B7280]">
        <span className="flex items-center gap-2"><i className="h-0.5 w-4 bg-[#FF8615]" />Final received</span>
        <span className="flex items-center gap-2"><i className="h-0.5 w-4 bg-[#55565A]" />GP1</span>
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#E86F00]">{eyebrow}</p>}
        <h2 className="text-lg font-bold tracking-[-0.02em] text-[#1F2937]">{title}</h2>
        {description && <p className="mt-1 text-sm text-[#6B7280]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard" aria-busy="true">
      <div className="flex items-center justify-between"><div><Skeleton className="h-7 w-52" /><Skeleton className="mt-2 h-4 w-72" /></div><Skeleton className="h-10 w-32" /></div>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
      <div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-[390px] rounded-2xl" /><Skeleton className="h-[390px] rounded-2xl" /></div>
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <Card className="grid min-h-[480px] place-items-center p-8 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#FFF4E9] text-[#E86F00]"><PackageSearch size={28} /></span>
        <h2 className="mt-5 text-xl font-bold text-[#1F2937]">No data for this view</h2>
        <p className="mt-2 text-sm leading-6 text-[#6B7280]">Try another reporting period or clear your filters to return to the full KMM H1 dataset.</p>
        <Button className="mt-6" onClick={onClear}>Clear filters</Button>
      </div>
    </Card>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="grid min-h-[480px] place-items-center border-[#FEE2E2] p-8 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#FEF2F2] text-[#EF4444]"><AlertTriangle size={28} /></span>
        <h2 className="mt-5 text-xl font-bold text-[#1F2937]">We couldn’t refresh the dashboard</h2>
        <p className="mt-2 text-sm leading-6 text-[#6B7280]">Your previous data is safe. Check the connection and try loading the H1 report again.</p>
        <Button className="mt-6" onClick={onRetry}><RefreshCw size={16} />Try again</Button>
      </div>
    </Card>
  );
}

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("Overview");
  const [branch, setBranch] = useState("All branches");
  const [period, setPeriod] = useState("H1 2026");
  const [search, setSearch] = useState("");
  const [viewState, setViewState] = useState<ViewState>("ready");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [refreshed, setRefreshed] = useState("10 Jul 2026, 09:30");

  useEffect(() => {
    const state = new URLSearchParams(window.location.search).get("state");
    if (state === "loading" || state === "empty" || state === "error") setViewState(state);
  }, []);

  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return branches.filter((item) => (branch === "All branches" || branch === item.name) && (!q || `${item.name} ${item.action}`.toLowerCase().includes(q)));
  }, [branch, search]);

  function navigate(item: (typeof navItems)[number]) {
    setActiveNav(item.label);
    setMobileOpen(false);
    document.querySelector(item.href)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function refresh() {
    setViewState("loading");
    window.setTimeout(() => {
      setViewState("ready");
      setRefreshed("Just now");
    }, 850);
  }

  function clearEmptyState() {
    window.history.replaceState(null, "", window.location.pathname);
    setSearch("");
    setBranch("All branches");
    setViewState("ready");
  }

  function exportCsv() {
    const rows = [["Branch", "Sales", "Bookings", "Stock", "Final received (MMK B)"], ...branches.map((b) => [b.name, b.sales, b.booking, b.stock, b.revenue])];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kmm-h1-2026-branch-summary.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const sidebar = (
    <>
      <div className="flex h-[82px] items-center justify-between border-b border-[#ECEDEF] px-5">
        <img src="/kmm-logo.png" alt="Kubota Maesod Myanmar" className={cn("h-11 w-auto object-contain object-left transition-all", collapsed ? "max-w-10 object-[9%_center]" : "max-w-[128px]")} />
        <button className="hidden rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#F4F5F7] hover:text-[#55565A] lg:block" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <ChevronDown className={cn("rotate-90 transition-transform", collapsed && "-rotate-90")} size={18} />
        </button>
        <button className="rounded-lg p-2 text-[#55565A] hover:bg-[#F4F5F7] lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button>
      </div>
      <nav className="flex-1 space-y-1 p-3" aria-label="Primary navigation">
        {!collapsed && <p className="px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#A1A5AC]">Performance</p>}
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeNav === item.label;
          return (
            <button key={item.label} onClick={() => navigate(item)} className={cn("group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all", active ? "bg-[#FFF1E3] text-[#E86F00]" : "text-[#606168] hover:bg-[#F6F7F8] hover:text-[#1F2937]", collapsed && "justify-center px-2")} title={collapsed ? item.label : undefined}>
              <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
              {!collapsed && <span>{item.label}</span>}
              {active && !collapsed && <span className="ml-auto size-1.5 rounded-full bg-[#FF8615]" />}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-[#ECEDEF] p-3">
        <button className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#606168] transition-colors hover:bg-[#F6F7F8] hover:text-[#1F2937]", collapsed && "justify-center px-2")}>
          <Settings size={19} />{!collapsed && "Settings"}
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
    <div className="min-h-screen bg-[#F8FAFC] text-[#1F2937]">
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[#E5E7EB] bg-white transition-[width] duration-300 lg:flex", collapsed ? "w-[76px]" : "w-[240px]")}>{sidebar}</aside>
      {mobileOpen && <button className="fixed inset-0 z-40 bg-[#1F2937]/35 backdrop-blur-[2px] lg:hidden" aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-white shadow-2xl transition-transform duration-300 lg:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}>{sidebar}</aside>

      <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[240px]")}>
        <header className="sticky top-0 z-30 flex h-[82px] items-center gap-3 border-b border-[#E5E7EB] bg-white/95 px-4 backdrop-blur-md sm:px-6 xl:px-8">
          <button className="rounded-xl border border-[#E5E7EB] p-2.5 text-[#55565A] hover:bg-[#F8FAFC] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={17} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] pl-10 pr-4 text-sm text-[#1F2937] outline-none transition focus:border-[#FFB46E] focus:bg-white focus:ring-4 focus:ring-[#FF8615]/10" placeholder="Search branch or action…" aria-label="Search dashboard" />
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Badge variant="outline" className="hidden gap-2 py-2 sm:inline-flex"><span className="size-2 rounded-full bg-[#22C55E]" />Live data</Badge>
            <div className="relative">
              <button className="relative grid size-10 place-items-center rounded-xl border border-[#E5E7EB] text-[#55565A] transition hover:border-[#D1D5DB] hover:bg-[#F8FAFC]" onClick={() => setNotificationsOpen((v) => !v)} aria-label="Open notifications" aria-expanded={notificationsOpen}>
                <Bell size={18} /><span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#EF4444]" />
              </button>
              {notificationsOpen && (
                <Card className="absolute right-0 top-12 z-50 w-[310px] p-2 shadow-xl">
                  <div className="flex items-center justify-between px-3 py-2"><strong className="text-sm">Attention needed</strong><Badge variant="danger">2</Badge></div>
                  <div className="rounded-xl p-3 hover:bg-[#F8FAFC]"><p className="text-sm font-semibold">Aged stock is above guardrail</p><p className="mt-1 text-xs leading-5 text-[#6B7280]">506 rows are marked 91+ days.</p></div>
                  <div className="rounded-xl p-3 hover:bg-[#F8FAFC]"><p className="text-sm font-semibold">Finance definition pending</p><p className="mt-1 text-xs leading-5 text-[#6B7280]">Confirm the official revenue field.</p></div>
                </Card>
              )}
            </div>
            <button className="flex items-center gap-2 rounded-xl p-1.5 pr-2 transition hover:bg-[#F8FAFC]" aria-label="Open profile menu">
              <span className="grid size-9 place-items-center rounded-xl bg-[#55565A] text-xs font-bold text-white">KM</span>
              <span className="hidden text-left xl:block"><span className="block text-xs font-semibold">KMM Admin</span><span className="block text-[10px] text-[#9CA3AF]">Executive view</span></span>
              <ChevronDown className="hidden text-[#9CA3AF] xl:block" size={15} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
          {viewState === "loading" ? <LoadingDashboard /> : viewState === "empty" ? <EmptyState onClear={clearEmptyState} /> : viewState === "error" ? <ErrorState onRetry={refresh} /> : (
            <div className="space-y-6">
              <section id="overview" className="scroll-mt-28">
                <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#6B7280]"><CalendarDays size={14} />Friday, 10 July 2026</div>
                    <h1 className="text-2xl font-bold tracking-[-0.035em] text-[#1F2937] sm:text-[30px]">Executive performance overview</h1>
                    <p className="mt-2 text-sm text-[#6B7280]">KMM Half-Year Review · refreshed {refreshed}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={exportCsv}><Download size={16} />Export report</Button>
                    <Button onClick={refresh}><RefreshCw size={16} />Refresh data</Button>
                  </div>
                </div>

                <Card className="mt-6 overflow-hidden border-[#FFD5AE] bg-[linear-gradient(100deg,#FFF8F1_0%,#FFFFFF_68%)] p-0">
                  <div className="grid md:grid-cols-[1fr_auto]">
                    <div className="flex gap-4 p-5 sm:p-6">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#FF8615] text-white shadow-[0_6px_18px_rgba(255,134,21,0.25)]"><Lightbulb size={21} /></span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-[#1F2937]">H1 is within reach on volume, but quality needs attention.</p><Badge variant="warning">Executive focus</Badge></div>
                        <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#6B7280]">Sales reached 92% of plan. The immediate H2 opportunity is converting 59 open bookings while reducing 506 aged-stock rows with margin discipline.</p>
                      </div>
                    </div>
                    <div className="flex items-center border-t border-[#FFE3C7] px-6 py-4 md:border-l md:border-t-0">
                      <button onClick={() => navigate(navItems[6])} className="inline-flex items-center gap-2 text-sm font-bold text-[#D96500] transition-all hover:gap-3">View H2 actions <ArrowRight size={16} /></button>
                    </div>
                  </div>
                </Card>

                <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-[0_2px_10px_rgba(31,41,55,0.03)]">
                  <span className="px-2 text-xs font-semibold text-[#6B7280]">View</span>
                  <div className="flex rounded-xl bg-[#F3F4F6] p-1">
                    {["H1 2026", "Q2 2026", "Jun 2026"].map((value) => <button key={value} onClick={() => setPeriod(value)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", period === value ? "bg-white text-[#1F2937] shadow-sm" : "text-[#73767D] hover:text-[#1F2937]")}>{value}</button>)}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Building2 size={15} className="text-[#9CA3AF]" />
                    <select value={branch} onChange={(e) => setBranch(e.target.value)} className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#55565A] outline-none focus:border-[#FFB46E]" aria-label="Filter by branch">
                      <option>All branches</option>{branches.map((item) => <option key={item.name}>{item.name}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map((item, index) => <KpiCard key={item.label} item={item} index={index} />)}</section>

              <section id="performance" className="grid scroll-mt-28 gap-4 xl:grid-cols-2">
                <Card className="p-5 sm:p-6">
                  <SectionHeader eyebrow="Volume performance" title="Sales actual vs plan" description="Monthly delivered units · H1 2026" action={<button className="text-xs font-semibold text-[#6B7280] hover:text-[#E86F00]">View details</button>} />
                  <SalesChart />
                </Card>
                <Card className="p-5 sm:p-6">
                  <SectionHeader eyebrow="Financial quality" title="Revenue and GP1 trend" description="Monthly MMK billions · finance validation pending" action={<Badge variant="warning">Requires validation</Badge>} />
                  <RevenueChart />
                </Card>
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.45fr_0.8fr]">
                <Card id="branches" className="scroll-mt-28 overflow-hidden">
                  <div className="p-5 sm:p-6"><SectionHeader eyebrow="Operating drivers" title="Branch performance" description="Volume, pipeline, and stock concentration" action={<Button variant="ghost" size="sm">All branches <ArrowRight size={14} /></Button>} /></div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="border-y border-[#E8EAED] bg-[#FAFBFC] text-[11px] uppercase tracking-[0.08em] text-[#8A8E96]"><tr><th className="px-6 py-3 font-semibold">Branch</th><th className="px-4 py-3 font-semibold">Sales</th><th className="px-4 py-3 font-semibold">Bookings</th><th className="px-4 py-3 font-semibold">Stock</th><th className="px-4 py-3 font-semibold">Final received</th><th className="px-4 py-3 font-semibold">Priority</th></tr></thead>
                      <tbody className="divide-y divide-[#EFF0F2]">
                        {filteredBranches.map((item) => (
                          <tr key={item.name} className="transition-colors hover:bg-[#FFF9F3]">
                            <td className="px-6 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#F2F3F5] text-xs font-bold text-[#55565A]">{item.name.slice(-2)}</span><div><p className="font-bold text-[#1F2937]">{item.name}</p><p className="text-xs text-[#9CA3AF]">Myanmar</p></div></div></td>
                            <td className="px-4 py-4 font-semibold">{item.sales}</td><td className="px-4 py-4">{item.booking}</td><td className="px-4 py-4"><span className={item.stock > 200 ? "font-bold text-[#DC2626]" : "font-medium"}>{item.stock}</span></td><td className="px-4 py-4">{item.revenue} <span className="text-[10px] text-[#9CA3AF]">MMK</span></td>
                            <td className="px-4 py-4"><Badge variant={item.tone as "success" | "warning" | "danger"}>{item.action}</Badge></td>
                          </tr>
                        ))}
                        {filteredBranches.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-[#6B7280]">No branches match “{search}”.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8EAED] bg-[#FAFBFC] px-6 py-3 text-xs text-[#6B7280]"><span>Showing {filteredBranches.length} of 3 branches</span><span>KMM03 contributes <strong className="text-[#1F2937]">61%</strong> of sales volume</span></div>
                </Card>

                <Card id="inventory" className="scroll-mt-28 p-5 sm:p-6">
                  <SectionHeader eyebrow="Risk guardrail" title="Inventory ageing" description="606 total stock rows" action={<Badge variant="danger">High risk</Badge>} />
                  <div className="mt-7 flex items-center gap-7">
                    <div className="relative size-36 shrink-0 rounded-full bg-[conic-gradient(#EF4444_0_83%,#F59E0B_83%_88%,#FFD6B0_88%_100%)] p-[13px] shadow-inner">
                      <div className="grid size-full place-items-center rounded-full bg-white text-center"><div><strong className="block text-3xl tracking-[-0.04em]">83%</strong><span className="text-[11px] font-semibold text-[#6B7280]">91+ days</span></div></div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      {[{ label: "91+ days", value: 506, color: "bg-[#EF4444]" }, { label: "31–90 days", value: 46, color: "bg-[#F59E0B]" }, { label: "0–30 days", value: 53, color: "bg-[#FFD6B0]" }].map((item) => <div key={item.label}><div className="mb-1.5 flex justify-between text-xs"><span className="flex items-center gap-2 text-[#6B7280]"><i className={cn("size-2 rounded-full", item.color)} />{item.label}</span><strong>{item.value}</strong></div><Progress value={(item.value / 606) * 100} indicatorClassName={item.color} /></div>)}
                    </div>
                  </div>
                  <div className="mt-7 rounded-xl border border-[#FECACA] bg-[#FFF7F7] p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-[#EF4444]" size={18} /><div><p className="text-sm font-bold">Clearance decision required</p><p className="mt-1 text-xs leading-5 text-[#6B7280]">KMM02 holds 282 stock rows. Prioritize model-level transfers before discounting.</p></div></div></div>
                </Card>
              </section>

              <section className="grid gap-4 lg:grid-cols-3">
                <Card id="bookings" className="scroll-mt-28 p-5 sm:p-6">
                  <SectionHeader eyebrow="Demand funnel" title="Booking conversion" description="266 H1 booking rows" />
                  <div className="mt-6 space-y-3">
                    {[{ label: "Total bookings", value: 266, width: "100%", color: "bg-[#55565A]" }, { label: "Converted / out", value: 133, width: "72%", color: "bg-[#22C55E]" }, { label: "Cancelled", value: 74, width: "51%", color: "bg-[#EF4444]" }, { label: "Open backlog", value: 59, width: "42%", color: "bg-[#FF8615]" }].map((item) => <div key={item.label} className={cn("flex min-w-44 items-center justify-between rounded-xl px-4 py-3 text-white", item.color)} style={{ width: item.width }}><span className="text-xs font-semibold">{item.label}</span><strong>{item.value}</strong></div>)}
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-[#EFF0F2] pt-4 text-xs"><span className="text-[#6B7280]">Observed conversion</span><strong className="text-[#16A34A]">50.0%</strong></div>
                </Card>

                <Card className="p-5 sm:p-6">
                  <SectionHeader eyebrow="Product concentration" title="Top-selling models" description="Delivered units · H1 2026" />
                  <div className="mt-6 space-y-4">
                    {[{ name: "DC70G PRO", value: 34 }, { name: "M6040HI+FD", value: 32 }, { name: "RX220H", value: 28 }, { name: "RX220G", value: 21 }, { name: "DH247H", value: 18 }].map((item, i) => <div key={item.name}><div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold text-[#55565A]"><span className="mr-2 text-[#B0B3B8]">0{i + 1}</span>{item.name}</span><strong>{item.value}</strong></div><Progress value={(item.value / 34) * 100} /></div>)}
                  </div>
                </Card>

                <Card className="p-5 sm:p-6">
                  <SectionHeader eyebrow="Channel signal" title="Market demand" description="Customer source and territory" />
                  <div className="mt-6 space-y-4">
                    <div className="rounded-2xl bg-[#FFF5EB] p-4"><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-white text-[#E86F00]"><Users size={19} /></span><Badge variant="warning">83% share</Badge></div><strong className="mt-5 block text-2xl">221</strong><p className="mt-1 text-xs text-[#6B7280]">Broker-sourced H1 bookings</p></div>
                    <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-[#E8EAED] p-3"><strong className="block text-lg">130</strong><span className="text-[11px] text-[#6B7280]">Bago West sales</span></div><div className="rounded-xl border border-[#E8EAED] p-3"><strong className="block text-lg">#1</strong><span className="text-[11px] text-[#6B7280]">Top territory</span></div></div>
                    <p className="flex items-start gap-2 text-xs leading-5 text-[#6B7280]"><Lightbulb className="mt-0.5 shrink-0 text-[#FF8615]" size={15} />Broker dependency needs an ROI guardrail before scaling H2 acquisition.</p>
                  </div>
                </Card>
              </section>

              <section id="actions" className="scroll-mt-28">
                <Card className="overflow-hidden">
                  <div className="flex flex-col gap-5 border-b border-[#E8EAED] bg-[#55565A] p-6 text-white sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FFC48C]">Next half priorities</p><h2 className="mt-1 text-xl font-bold">H2 execution agenda</h2><p className="mt-1 text-sm text-white/65">Three moves to convert operating insight into action.</p></div><Button className="bg-white text-[#3F4044] hover:bg-[#FFF1E3]">Open action plan <ArrowRight size={16} /></Button></div>
                  <div className="grid divide-y divide-[#E8EAED] md:grid-cols-3 md:divide-x md:divide-y-0">
                    {[{ icon: ClipboardCheck, number: "01", title: "Convert demand", text: "Clean booking status and review the 59 open bookings weekly.", metric: "59 open bookings" }, { icon: Boxes, number: "02", title: "Clear aged stock", text: "Match stock to demand and approve branch transfers before discounting.", metric: "506 aged rows" }, { icon: CircleDollarSign, number: "03", title: "Protect margin", text: "Use GP1 and discount guardrails for every clearance decision.", metric: "8.9% GP1 baseline" }].map((item) => { const Icon = item.icon; return <div key={item.title} className="group p-6 transition-colors hover:bg-[#FFFBF7]"><div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-xl bg-[#FFF1E3] text-[#E86F00]"><Icon size={20} /></span><span className="text-2xl font-bold text-[#E5E7EB]">{item.number}</span></div><h3 className="mt-5 font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#6B7280]">{item.text}</p><div className="mt-5 flex items-center gap-2 text-xs font-bold text-[#D96500]"><Target size={14} />{item.metric}</div></div>; })}
                  </div>
                </Card>
              </section>

              <footer className="flex flex-col gap-2 border-t border-[#E5E7EB] py-4 text-[11px] text-[#8A8E96] sm:flex-row sm:items-center sm:justify-between"><p>Sources: Sales KPI, CPI, Booking, Stock, and Marketing files · generated 7 Jul 2026</p><p className="flex items-center gap-1.5"><Check size={13} className="text-[#22C55E]" />Operational metrics reconciled · finance fields require sign-off</p></footer>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
