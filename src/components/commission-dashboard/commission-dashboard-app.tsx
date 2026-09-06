"use client";

import { useState } from "react";

import type { DashboardOverview } from "@/features/commission-dashboard/types/dashboard-data";
import type { EmployeesOverview } from "@/features/commission-dashboard/types/employees-data";
import type { GoalsOverview } from "@/features/commission-dashboard/types/goals-data";
import type { ReportsOverview } from "@/features/commission-dashboard/types/reports-data";
import type { UnitsOverview } from "@/features/commission-dashboard/types/units-data";
import type { TabId } from "@/types/commission-dashboard";
import type { CommissionRuleSetDto } from "@/features/commission-dashboard/rules/manage-commission-rules";

import { CommissionSidebar } from "./sidebar";
import { DashboardTab } from "./tabs/dashboard-tab";
import { EmployeesTab } from "./tabs/employees-tab";
import { GoalsTab } from "./tabs/goals-tab";
import { ReportsTab } from "./tabs/reports-tab";
import { UnitsTab } from "./tabs/units-tab";
import { SettingsTab } from "./tabs/settings-tab";
import { CommissionTopbar } from "./topbar";

export function CommissionDashboardApp({
  dashboardOverview,
  goalsOverview,
  employeesOverview,
  unitsOverview,
  reportsOverview,
  commissionRulesCurrent,
  commissionRulesHistory,
}: {
  dashboardOverview: DashboardOverview;
  goalsOverview: GoalsOverview;
  employeesOverview: EmployeesOverview;
  unitsOverview: UnitsOverview;
  reportsOverview: ReportsOverview;
  commissionRulesCurrent: CommissionRuleSetDto | null;
  commissionRulesHistory: CommissionRuleSetDto[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-[#F1F3F6] text-[14px] text-text-primary lg:h-screen lg:flex-row lg:overflow-hidden">
      <CommissionSidebar activeTab={activeTab} onSelect={setActiveTab} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <CommissionTopbar activeTab={activeTab} period={dashboardOverview.period} isClosed={goalsOverview.units.length > 0 && goalsOverview.units.every((unit) => unit.closedAt != null)} />
        <main className="flex-1 overflow-y-auto px-5 py-5 lg:px-8 lg:py-6">
          {activeTab === "dashboard" ? <DashboardTab overview={dashboardOverview} /> : null}
          {activeTab === "unidades" ? <UnitsTab overview={unitsOverview} /> : null}
          {activeTab === "funcionarios" ? (
            <EmployeesTab overview={employeesOverview} />
          ) : null}
          {activeTab === "metas" ? <GoalsTab overview={goalsOverview} /> : null}
          {activeTab === "relatorios" ? <ReportsTab initialOverview={reportsOverview} /> : null}
          {activeTab === "configuracoes" ? <SettingsTab initialCurrent={commissionRulesCurrent} initialHistory={commissionRulesHistory} /> : null}
        </main>
        <footer className="px-8 py-2 text-right text-[9px] uppercase tracking-[1px] text-text-muted">
          ARGUS COMISS · {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
