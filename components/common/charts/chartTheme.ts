export const chartTheme = {
  current: "#FF7A00",
  previous: "#64748B",
  older: ["#94A3B8", "#CBD5E1", "#E2E8F0"],
  target: "#9CA3AF",
  grid: "#E5E7EB",
  text: "#6B7280",
  ink: "#1F2937",
  surface: "#FFFFFF",
  marketing: {
    heatScale: ["#FFF8F3", "#FFE7D6", "#F4C09A", "#D98A59", "#C45100"],
    zero: "#F3F4F6",
    noData: "#F8FAFC",
  },
  product: {
    core: "#3A8F5B",
    attention: "#D85C5C",
    strategic: "#D99A00",
    neutral: "#64748B",
    muted: "#94A3B8",
  },
  status: {
    positive: "#16A34A",
    negative: "#DC2626",
    warning: "#F59E0B",
  },
} as const;

export const chartProductColors = {
  TT: chartTheme.product.core,
  CH: chartTheme.product.core,
  EX: chartTheme.product.core,
  IM: chartTheme.product.attention,
  IMO: chartTheme.product.attention,
  TP: chartTheme.product.strategic,
  MAX: chartTheme.product.neutral,
  OT: chartTheme.product.muted,
  OTHER: chartTheme.product.muted,
} as const;

export function chartProductColor(label: string) {
  return chartProductColors[label.trim().toUpperCase() as keyof typeof chartProductColors] ?? chartTheme.product.muted;
}

export const chartStroke = { current: 4, previous: 4, older: 3, target: 3 } as const;
