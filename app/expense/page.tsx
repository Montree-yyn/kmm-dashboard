import { ExpenseIntelligencePage } from "../../components/expense/expense-intelligence-page";
import { CompanyModuleGuard } from "../../components/company/company-module-guard";

export default function ExpensePage() {
  return (
    <CompanyModuleGuard module="expense">
      <ExpenseIntelligencePage />
    </CompanyModuleGuard>
  );
}
