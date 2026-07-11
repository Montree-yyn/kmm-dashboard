"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";

export function HomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      router.replace(user ? "/dashboard" : "/login");
    });

    return unsubscribe;
  }, [router]);

  return (
    <div className="grid min-h-screen place-items-center bg-[#F8FAFC]">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#FFE1C4] border-t-[#FF8615]" />
    </div>
  );
}
