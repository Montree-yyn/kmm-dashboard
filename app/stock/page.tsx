import { AuthGate } from "../../components/auth/auth-gate";
import { StockIntelligencePage } from "../../components/stock/stock-intelligence-page";

export default function StockPage() {
  return (
    <AuthGate>
      <StockIntelligencePage />
    </AuthGate>
  );
}
