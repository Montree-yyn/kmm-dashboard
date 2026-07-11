import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "../ui/button";

type ExportButtonProps = {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  formatMenu?: ReactNode;
};

export function ExportButton({ onClick, loading = false, disabled = false, formatMenu }: ExportButtonProps) {
  return (
    <div className="flex items-center gap-2">
      <Button className="h-11" onClick={onClick} disabled={disabled || loading} aria-busy={loading}>
        <Download size={16} />{loading ? "Exporting" : "Export"}
      </Button>
      {formatMenu}
    </div>
  );
}
