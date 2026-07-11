import { AuthGate } from "../../components/auth/auth-gate";
import { PlaceholderPage } from "../../components/navigation/placeholder-page";

export default function ExpensePage() {
  return (
    <AuthGate>
      <PlaceholderPage title="Expense" />
    </AuthGate>
  );
}
