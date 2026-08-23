import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "../../lib/utils";

export type StatusMessageKind = "success" | "warning" | "error" | "neutral";

type StatusMessageProps = {
  status: StatusMessageKind;
  message: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  role?: "status" | "alert";
};

const PRESENTATION: Record<StatusMessageKind, {
  icon: typeof CheckCircle2;
  color: string;
  surface: string;
}> = {
  success: {
    icon: CheckCircle2,
    color: "text-[var(--status-success)]",
    surface: "border-[color-mix(in_srgb,var(--status-success)_24%,transparent)] bg-[color-mix(in_srgb,var(--status-success)_7%,white)]",
  },
  warning: {
    icon: TriangleAlert,
    color: "text-[var(--status-warning)]",
    surface: "border-[color-mix(in_srgb,var(--status-warning)_28%,transparent)] bg-[color-mix(in_srgb,var(--status-warning)_8%,white)]",
  },
  error: {
    icon: AlertCircle,
    color: "text-[var(--status-danger)]",
    surface: "border-[color-mix(in_srgb,var(--status-danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--status-danger)_7%,white)]",
  },
  neutral: {
    icon: Info,
    color: "text-[var(--text-secondary)]",
    surface: "border-[var(--border-default)] bg-[var(--surface-subtle)]",
  },
};

export function StatusMessage({
  status,
  message,
  title,
  action,
  className,
  role = status === "error" ? "alert" : "status",
}: StatusMessageProps) {
  const presentation = PRESENTATION[status];
  const Icon = presentation.icon;
  return (
    <div
      className={cn("flex items-start gap-3 rounded-[var(--radius-control-lg)] border px-3 py-3 text-sm", presentation.surface, className)}
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      data-enterprise-component="status-message"
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", presentation.color)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className={cn("font-semibold", presentation.color)}>{title}</p>}
        <p className={cn(title ? "mt-0.5" : "font-medium", "text-[var(--text-primary)]")}>{message}</p>
      </div>
      {action}
    </div>
  );
}
