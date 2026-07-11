"use client";

import { useState } from "react";
import { Bell, ChevronDown, Menu } from "lucide-react";
import { AppSidebar } from "./app-sidebar";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { HeaderPresentationTrigger } from "../presentation/HeaderPresentationTrigger";

export function PlaceholderPage({ title }: { title: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1F2937]">
      <AppSidebar collapsed={collapsed} mobileOpen={mobileOpen} onCollapsedChange={setCollapsed} onMobileOpenChange={setMobileOpen} />
      <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[240px]")}>
        <header className="sticky top-0 z-30 flex h-[82px] items-center gap-3 border-b border-[#E5E7EB] bg-white/95 px-4 backdrop-blur-md sm:px-6 xl:px-8">
          <button className="rounded-xl border border-[#E5E7EB] p-2.5 text-[#55565A] hover:bg-[#F8FAFC] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div>
            <h1 className="text-lg font-bold tracking-[-0.02em] text-[#1F2937]">{title}</h1>
            <p className="text-xs text-[#9CA3AF]">KMM Sales Intelligence</p>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <HeaderPresentationTrigger />
            <button className="relative grid size-10 place-items-center rounded-xl border border-[#E5E7EB] text-[#55565A] transition hover:border-[#D1D5DB] hover:bg-[#F8FAFC]" aria-label="Open notifications">
              <Bell size={18} /><span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#EF4444]" />
            </button>
            <button className="flex items-center gap-2 rounded-xl p-1.5 pr-2 transition hover:bg-[#F8FAFC]" aria-label="Open profile menu">
              <span className="grid size-9 place-items-center rounded-xl bg-[#55565A] text-xs font-bold text-white">KM</span>
              <span className="hidden text-left xl:block"><span className="block text-xs font-semibold">KMM Admin</span><span className="block text-[10px] text-[#9CA3AF]">Executive view</span></span>
              <ChevronDown className="hidden text-[#9CA3AF] xl:block" size={15} />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
          <Card className="grid min-h-[420px] place-items-center p-8 text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#FFF4E9] text-xl font-bold text-[#E86F00]">{title.slice(0, 1)}</span>
              <h2 className="mt-5 text-xl font-bold text-[#1F2937]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#6B7280]">This page is ready for future content.</p>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
