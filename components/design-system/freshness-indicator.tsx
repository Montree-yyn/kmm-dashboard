"use client";

import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { useLocale } from "../../src/hooks/useLocale";
import { intlLocales } from "../../src/locales";

type FreshnessIndicatorProps = {
  timestamp?: string | null;
  label?: string;
  className?: string;
};

function relativeTime(timestamp: number, now: number, locale: string) {
  const seconds = (timestamp - now) / 1000;
  const absolute = Math.abs(seconds);
  const [value, unit] = absolute < 60
    ? [Math.round(seconds), "second"]
    : absolute < 3600
      ? [Math.round(seconds / 60), "minute"]
      : absolute < 86400
        ? [Math.round(seconds / 3600), "hour"]
        : [Math.round(seconds / 86400), "day"];
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    value,
    unit as Intl.RelativeTimeFormatUnit,
  );
}

export function FreshnessIndicator({
  timestamp,
  label,
  className,
}: FreshnessIndicatorProps) {
  const { language, t } = useLocale();
  const resolvedLabel = label ?? t("common.viewRefreshed");
  const locale = intlLocales[language];
  const [now, setNow] = useState<number | null>(null);
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!Number.isFinite(parsed)) {
    return <p className={cn("text-xs text-[var(--text-tertiary)]", className)}>{label ?? t("common.freshnessUnavailable")}</p>;
  }

  const exact = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
  const relative = now === null ? null : relativeTime(parsed, now, locale);

  return (
    <p className={cn("text-xs text-[var(--text-tertiary)]", className)}>
      <span>{resolvedLabel}</span>{" "}
      <time className="kmm-tabular" dateTime={new Date(parsed).toISOString()} title={exact}>
        {relative ? `${relative} · ${exact}` : exact}
      </time>
    </p>
  );
}
