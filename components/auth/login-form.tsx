"use client";

import { useEffect, useState } from "react";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { auth } from "../../lib/firebase";

function getAuthErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    const code = String(error.code);
    if (code.includes("invalid-credential") || code.includes("user-not-found") || code.includes("wrong-password")) {
      return "Email or password is incorrect.";
    }
    if (code.includes("too-many-requests")) {
      return "Too many login attempts. Please wait and try again.";
    }
  }

  return "Unable to sign in. Please check your details and try again.";
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/dashboard");
        return;
      }

      setCheckingSession(false);
    });

    return unsubscribe;
  }, [router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setSuccess("Login successful. Redirecting to dashboard...");
      router.replace("/dashboard");
    } catch (loginError) {
      setError(getAuthErrorMessage(loginError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#FFF1E3_0,#F8FAFC_34%,#F8FAFC_100%)] px-4 py-10">
      <Card className="w-full max-w-[440px] rounded-2xl border-[#E8EAED] bg-white p-6 shadow-[0_24px_70px_rgba(31,41,55,0.12)] sm:p-8">
        <div className="text-center">
          <img src="/kmm-logo.png" alt="Kubota Maesod Myanmar" className="mx-auto h-16 w-auto object-contain" />
          <h1 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-[#1F2937]">KMM Sales Intelligence</h1>
          <p className="mt-2 text-sm text-[#6B7280]">Sign in with your enterprise account.</p>
        </div>

        {checkingSession ? (
          <div className="mt-8 grid place-items-center gap-3 py-10">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#FFE1C4] border-t-[#FF8615]" />
            <p className="text-sm font-semibold text-[#6B7280]">Checking login status...</p>
          </div>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={submit}>
            <label className="block">
              <span className="text-sm font-semibold text-[#55565A]">Email</span>
              <span className="mt-2 flex h-12 items-center rounded-xl border border-[#E0E2E5] bg-[#FAFBFC] px-3 transition-within focus-within:border-[#FFB46E] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#FF8615]/10">
                <Mail size={18} className="text-[#9CA3AF]" />
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-[#1F2937] outline-none"
                  placeholder="name@kmm.com"
                />
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[#55565A]">Password</span>
              <span className="mt-2 flex h-12 items-center rounded-xl border border-[#E0E2E5] bg-[#FAFBFC] px-3 focus-within:border-[#FFB46E] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#FF8615]/10">
                <LockKeyhole size={18} className="text-[#9CA3AF]" />
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-[#1F2937] outline-none"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="grid size-9 place-items-center rounded-lg text-[#6B7280] transition hover:bg-[#F1F2F4] hover:text-[#1F2937]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-[#55565A]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="size-4 rounded border-[#D1D5DB] accent-[#FF8615]"
                />
                Remember Login
              </label>
            </div>

            {error && <div className="rounded-xl border border-[#FECACA] bg-[#FFF7F7] px-4 py-3 text-sm font-medium text-[#B91C1C]">{error}</div>}
            {success && (
              <div className="flex items-center gap-2 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm font-medium text-[#15803D]">
                <ShieldCheck size={17} />
                {success}
              </div>
            )}

            <Button type="submit" className="h-12 w-full rounded-xl text-base" disabled={loading}>
              {loading ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/45 border-t-white" />
                  Signing in
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
