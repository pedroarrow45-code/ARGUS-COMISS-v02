import { connection } from "next/server";

import { CommissionDashboardApp } from "@/components/commission-dashboard/commission-dashboard-app";
import { getDashboardOverview } from "@/features/commission-dashboard/queries/dashboard";
import { getEmployeesOverview } from "@/features/commission-dashboard/queries/employees";
import { getGoalsOverview } from "@/features/commission-dashboard/queries/goals";
import { getReportsOverview } from "@/features/commission-dashboard/queries/reports";
import { getUnitsOverview } from "@/features/commission-dashboard/queries/units";
import { getCurrentCommissionRuleSet, listCommissionRuleSetHistory } from "@/features/commission-dashboard/rules/manage-commission-rules";

export default async function HomePage() {
  await connection();

  const today = new Date();
  const period = {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  };

  const [dashboardOverview, goalsOverview, employeesOverview, unitsOverview, reportsOverview, commissionRulesCurrent, commissionRulesHistory] = await Promise.all([
    getDashboardOverview(period),
    getGoalsOverview(period),
    getEmployeesOverview(period),
    getUnitsOverview(period),
    getReportsOverview(period),
    getCurrentCommissionRuleSet(),
    listCommissionRuleSetHistory(),
  ]);

  return (
    <CommissionDashboardApp
      dashboardOverview={dashboardOverview}
      goalsOverview={goalsOverview}
      employeesOverview={employeesOverview}
      unitsOverview={unitsOverview}
      reportsOverview={reportsOverview}
      commissionRulesCurrent={commissionRulesCurrent}
      commissionRulesHistory={commissionRulesHistory}
    />
  );
}
