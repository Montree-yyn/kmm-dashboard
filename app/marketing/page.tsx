import { MarketingIntelligencePage } from "@/components/marketing/marketing-intelligence-page";
import { CompanyModuleGuard } from "@/components/company/company-module-guard";

export default function MarketingPage() {
  return (
    <CompanyModuleGuard module="marketing">
      <MarketingIntelligencePage />
    </CompanyModuleGuard>
  );
}
