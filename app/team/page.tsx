import { AuthGate } from "../../components/auth/auth-gate";
import { PlaceholderPage } from "../../components/navigation/placeholder-page";

export default function TeamPage() {
  return (
    <AuthGate>
      <PlaceholderPage title="Team" />
    </AuthGate>
  );
}
