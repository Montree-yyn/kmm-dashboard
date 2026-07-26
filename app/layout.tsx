import type { Metadata } from "next";
import "./globals.css";
import { PresentationLayout } from "../components/layout/PresentationLayout";
import { LocaleProvider } from "../src/context/LocaleContext";

export const metadata: Metadata = {
  title: "KMM Executive Dashboard | H1 2026",
  description: "KMM executive sales, booking, revenue, branch and inventory performance dashboard for H1 2026.",
  icons: {
    icon: "/kmm-logo.png",
    shortcut: "/kmm-logo.png",
  },
  openGraph: {
    title: "KMM Executive Dashboard",
    description: "H1 2026 performance, risk and H2 action in one decision-ready view.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body style={{ "--font-kmm": "Inter" } as React.CSSProperties}><LocaleProvider><PresentationLayout>{children}</PresentationLayout></LocaleProvider></body>
    </html>
  );
}
