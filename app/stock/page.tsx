import { AuthGate } from "../../components/auth/auth-gate";
import { PlaceholderPage } from "../../components/navigation/placeholder-page";

export default function StockPage() {
  return (
    <AuthGate>
      <PlaceholderPage title="Stock" />
    </AuthGate>
  );
}
