import type { Metadata } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-sans-thai/thai-400.css";
import "@fontsource/ibm-plex-sans-thai/thai-500.css";
import "@fontsource/ibm-plex-sans-thai/thai-600.css";
import "@fontsource/ibm-plex-sans-thai/thai-700.css";
import "@fontsource/noto-sans-myanmar/myanmar-400.css";
import "@fontsource/noto-sans-myanmar/myanmar-500.css";
import "@fontsource/noto-sans-myanmar/myanmar-600.css";
import "@fontsource/noto-sans-myanmar/myanmar-700.css";
import "./globals.css";
import { PresentationLayout } from "../components/layout/PresentationLayout";
import { GlobalAppShell } from "../components/layout/global-app-shell";
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
      <body>
        <template
          data-kmm-design-contract
          dangerouslySetInnerHTML={{
            __html:
              "<!-- KMM-V3.3-SELECTIVE-GLASS-20260811\nTHESIS: Precision Operations makes company-scoped decisions fast, calm, and trustworthy.\nOWN-WORLD: Warm canvas, matte data surfaces, Plus Jakarta Sans headings, Inter UI copy, KMM orange, and selective frosted controls.\nSTORY: Orient by company; scan KPIs; inspect trend and attention; act through filters, Data Hub, export, or KAI.\nFIRST VIEWPORT: Company context, freshness, five KPIs, primary sales trend, and actionable attention.\nFORM: Dense 4/8 rhythm, 14px cards, 18px floating bars, restrained shadow, no decorative glass on data.\nFINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md -->",
          }}
        />
        <LocaleProvider>
          <PresentationLayout>
            <GlobalAppShell>{children}</GlobalAppShell>
          </PresentationLayout>
        </LocaleProvider>
      </body>
    </html>
  );
}
