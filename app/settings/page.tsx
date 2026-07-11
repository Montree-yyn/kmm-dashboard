import { AuthGate } from "../../components/auth/auth-gate";
import { PlaceholderPage } from "../../components/navigation/placeholder-page";

export default function SettingsPage() {
  return (
    <AuthGate>
      <PlaceholderPage title="Settings" />
    </AuthGate>
  );
}
