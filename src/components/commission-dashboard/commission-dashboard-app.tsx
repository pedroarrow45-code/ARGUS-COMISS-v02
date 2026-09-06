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
    <div className="flex min-h-screen flex-col bg-bg text-[14px] text-text-primary lg:flex-row">
      <CommissionSidebar activeTab={activeTab} onSelect={setActiveTab} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <CommissionTopbar activeTab={activeTab} />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {activeTab === "dashboard" ? <DashboardTab overview={dashboardOverview} /> : null}
          {activeTab === "unidades" ? <UnitsTab overview={unitsOverview} /> : null}
          {activeTab === "funcionarios" ? (
            <EmployeesTab overview={employeesOverview} />
          ) : null}
          {activeTab === "metas" ? <GoalsTab overview={goalsOverview} /> : null}
          {activeTab === "relatorios" ? <ReportsTab initialOverview={reportsOverview} /> : null}
          {activeTab === "configuracoes" ? <SettingsTab initialCurrent={commissionRulesCurrent} initialHistory={commissionRulesHistory} /> : null}
        </main>
        <footer className="border-t border-border bg-surface px-3 py-2 text-center text-[10px] tracking-[0.5px] text-text-muted">
          POSTO BRASIL Sistema de Gestão de Comissões ·{" "}
          <span className="font-bold text-navy-700">Powered by ARGUS SYSTEMS</span> · {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
