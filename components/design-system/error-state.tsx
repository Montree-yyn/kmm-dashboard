"use client";

import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { StatusMessage } from "./status-message";
import { useLocale } from "../../src/hooks/useLocale";

type ErrorStateProps = { message: string; onRetry?: () => void; retryLabel?: ReactNode };

export function ErrorState({ message, onRetry, retryLabel }: ErrorStateProps) {
  const { t } = useLocale();
  return (
    <StatusMessage
      status="error"
      message={message}
      className="min-h-32 items-center justify-center text-center"
      action={onRetry ? <Button variant="outline" size="sm" onClick={onRetry}>{retryLabel ?? t("common.retry")}</Button> : undefined}
    />
  );
}
