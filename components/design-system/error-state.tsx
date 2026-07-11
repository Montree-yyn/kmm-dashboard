import type { ReactNode } from "react";
import { Button } from "../ui/button";

type ErrorStateProps = { message: string; onRetry?: () => void; retryLabel?: ReactNode };

export function ErrorState({ message, onRetry, retryLabel = "Retry" }: ErrorStateProps) {
  return (
    <div className="grid min-h-32 place-items-center gap-3 text-center">
      <p className="text-sm font-semibold text-[#B91C1C]">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{retryLabel}</Button>}
    </div>
  );
}
