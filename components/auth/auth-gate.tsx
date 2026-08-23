"use client";

import Image from "next/image";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { auth } from "../../lib/firebase";
import { loginPathFor } from "../../lib/auth/return-path";
import { useLocale } from "../../src/hooks/useLocale";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [allowed, setAllowed] = useState(false);
  const search = searchParams.toString();

  useEffect(() => {
    const returnTo = `${pathname}${search ? `?${search}` : ""}`;
    const loginPath = loginPathFor(returnTo);
    let settled = false;
    const fallback = window.setTimeout(() => {
      if (!settled) {
        router.replace(loginPath);
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        settled = true;
        window.clearTimeout(fallback);

        if (!user) {
          router.replace(loginPath);
          return;
        }

        setAllowed(true);
      },
      () => {
        settled = true;
        window.clearTimeout(fallback);
        router.replace(loginPath);
      },
    );

    return () => {
      settled = true;
      window.clearTimeout(fallback);
      unsubscribe();
    };
  }, [pathname, router, search]);

  if (!allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F8FAFC] text-[#1F2937]">
        <div className="flex flex-col items-center gap-4">
          <Image src="/kmm-logo.png" alt="Kubota Maesod Myanmar" width={224} height={56} priority className="h-14 w-auto" />
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#FFE1C4] border-t-[#FF8615]" />
          <p className="text-sm font-semibold text-[#6B7280]">{t("login.loadingDashboard")}</p>
        </div>
      </div>
    );
  }

  return children;
}
