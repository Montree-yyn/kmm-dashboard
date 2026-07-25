"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let settled = false;
    const fallback = window.setTimeout(() => {
      if (!settled) {
        router.replace("/login");
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        settled = true;
        window.clearTimeout(fallback);

        if (!user) {
          router.replace("/login");
          return;
        }

        setAllowed(true);
      },
      () => {
        settled = true;
        window.clearTimeout(fallback);
        router.replace("/login");
      },
    );

    return () => {
      settled = true;
      window.clearTimeout(fallback);
      unsubscribe();
    };
  }, [router]);

  if (!allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F8FAFC] text-[#1F2937]">
        <div className="flex flex-col items-center gap-4">
          <img src="/kmm-logo.png" alt="Kubota Maesod Myanmar" className="h-14 w-auto" />
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#FFE1C4] border-t-[#FF8615]" />
          <p className="text-sm font-semibold text-[#6B7280]">Loading secure dashboard...</p>
        </div>
      </div>
    );
  }

  return children;
}
