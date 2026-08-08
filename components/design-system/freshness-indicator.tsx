"use client";

import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";

type FreshnessIndicatorProps = {
  timestamp?: string | null;
  label?: string;
  className?: string;
};

function relativeTime(timestamp: number, now: number) {
  const seconds = (timestamp - now) / 1000;
  const absolute = Math.abs(seconds);
  const [value, unit] = absolute < 60
    ? [Math.round(seconds), "second"]
    : absolute < 3600
      ? [Math.round(seconds / 60), "minute"]
      : absolute < 86400
        ? [Math.round(seconds / 3600), "hour"]
        : [Math.round(seconds / 86400), "day"];
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
    value,
    unit as Intl.RelativeTimeFormatUnit,
  );
}

export function FreshnessIndicator({
  timestamp,
  label = "View refreshed",
  className,
}: FreshnessIndicatorProps) {
  const [now, setNow] = useState<number | null>(null);
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!Number.isFinite(parsed)) {
    return <p className={cn("text-xs text-[var(--text-tertiary)]", className)}>{label}</p>;
  }

  const exact = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
  const relative = now === null ? null : relativeTime(parsed, now);

  return (
    <p className={cn("text-xs text-[var(--text-tertiary)]", className)}>
      <span>{label}</span>{" "}
      <time className="kmm-tabular" dateTime={new Date(parsed).toISOString()} title={exact}>
        {relative ? `${relative} · ${exact}` : exact}
      </time>
    </p>
  );
}
