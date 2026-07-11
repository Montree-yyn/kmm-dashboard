import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sales Organization | KMM Sales Intelligence",
  description: "Sales organization, branch structure, performance and team capability.",
};

export default function TeamLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
