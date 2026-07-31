"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { AuthGate } from "../auth/auth-gate";
import { AppSidebar } from "../navigation/app-sidebar";
import { cn } from "../../lib/utils";
import { GlobalHeader } from "./global-header";

const shellRoutePrefixes = [
  "/dashboard",
  "/sales",
  "/booking",
  "/stock",
  "/marketing",
  "/settings",
  "/expense",
  "/team",
] as const;

function routeUsesAppShell(pathname: string) {
  return shellRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function GlobalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!routeUsesAppShell(pathname)) return children;

  return (
    <AuthGate>
      <div
        className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)]"
        data-global-app-shell
      >
        <AppSidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCollapsedChange={setCollapsed}
          onMobileOpenChange={setMobileOpen}
        />
        <div
          className={cn(
            "min-h-screen transition-[padding] duration-150 motion-reduce:transition-none",
            collapsed ? "lg:pl-[76px]" : "lg:pl-[240px]",
          )}
        >
          <GlobalHeader onOpenNavigation={() => setMobileOpen(true)} />
          {children}
        </div>
      </div>
    </AuthGate>
  );
}
