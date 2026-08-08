import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { StatusMessage } from "./status-message";

type ErrorStateProps = { message: string; onRetry?: () => void; retryLabel?: ReactNode };

export function ErrorState({ message, onRetry, retryLabel = "Retry" }: ErrorStateProps) {
  return (
    <StatusMessage
      status="error"
      message={message}
      className="min-h-32 items-center justify-center text-center"
      action={onRetry ? <Button variant="outline" size="sm" onClick={onRetry}>{retryLabel}</Button> : undefined}
    />
  );
}
