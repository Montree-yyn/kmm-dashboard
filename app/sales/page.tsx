import { AuthGate } from "../../components/auth/auth-gate";
import { SalesPage as SalesPerformancePage } from "../../components/sales/sales-page";

export default function SalesRoutePage() {
  return (
    <AuthGate>
      <SalesPerformancePage />
    </AuthGate>
  );
}
