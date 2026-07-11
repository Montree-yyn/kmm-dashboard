import { AuthGate } from "../../components/auth/auth-gate";
import { PlaceholderPage } from "../../components/navigation/placeholder-page";

export default function BookingPage() {
  return (
    <AuthGate>
      <PlaceholderPage title="Booking" />
    </AuthGate>
  );
}
