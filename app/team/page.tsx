import { AuthGate } from "../../components/auth/auth-gate";
import { SalesOrganizationPage } from "@/components/team/sales-organization-page";

export default function TeamPage() {
  return (
    <AuthGate>
      <SalesOrganizationPage />
    </AuthGate>
  );
}
