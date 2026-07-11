import { AuthGate } from "../../components/auth/auth-gate";
import { PlaceholderPage } from "../../components/navigation/placeholder-page";

export default function MarketingPage() {
  return (
    <AuthGate>
      <PlaceholderPage title="Marketing" />
    </AuthGate>
  );
}
