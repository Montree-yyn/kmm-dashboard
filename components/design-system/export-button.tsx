"use client";

import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "../ui/button";
import { useLocale } from "../../src/hooks/useLocale";

type ExportButtonProps = {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  formatMenu?: ReactNode;
};

export function ExportButton({ onClick, loading = false, disabled = false, formatMenu }: ExportButtonProps) {
  const { t } = useLocale();
  return (
    <div className="flex items-center gap-2">
      <Button className="h-11" onClick={onClick} disabled={disabled || loading} aria-busy={loading}>
        <Download size={16} />{loading ? t("common.exporting") : t("common.export")}
      </Button>
      {formatMenu}
    </div>
  );
}
