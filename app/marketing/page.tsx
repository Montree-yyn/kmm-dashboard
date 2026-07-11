import { AuthGate } from "@/components/auth/auth-gate";
import { MarketingIntelligencePage } from "@/components/marketing/marketing-intelligence-page";

export default function MarketingPage() {
  return (
    <AuthGate>
      <MarketingIntelligencePage />
    </AuthGate>
  );
}
