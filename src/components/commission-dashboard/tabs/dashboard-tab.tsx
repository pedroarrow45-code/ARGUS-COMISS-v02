import type { ReactNode } from "react";

import type { DashboardOverview } from "@/features/commission-dashboard/types/dashboard-data";
import { MONTHS } from "@/data/commission-dashboard";
import { formatCurrency, progressTone } from "@/lib/commission-dashboard";

import { BarChart } from "../chart";
import { DashboardIcon } from "../icons";
import { type BadgeTone, PageHeader, PanelCard, PanelCardBody, PanelCardHeader, ProgressBar, StatusBadge } from "../ui";

function KpiCard({
  tone,
  label,
  value,
  helper,
  icon,
}: {
  tone: "gold" | "navy" | "green" | "blue";
  label: string;
  value: string | number;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-border bg-surface px-5 py-[18px] shadow-panel">
      <div
        className={[
          "absolute inset-x-0 top-0 h-[3px]",
          tone === "gold" && "bg-[linear-gradient(90deg,#B8860B,#F5CC5A)]",
          tone === "navy" && "bg-[linear-gradient(90deg,#1D4170,#2A5A9E)]",
          tone === "green" && "bg-[linear-gradient(90deg,#1A9E5C,#30D17A)]",
          tone === "blue" && "bg-[linear-gradient(90deg,#2563EB,#60A5FA)]",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[1px] text-text-muted">{label}</div>
      <div className="font-mono text-[22px] font-semibold tracking-[-0.5px] text-text-primary">{value}</div>
      <div className="mt-1 text-[11px] text-text-muted">{helper}</div>
      <div
        className={[
          "absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg",
          tone === "gold" && "bg-gold-500/12 text-gold-600",
          tone === "navy" && "bg-navy-600/10 text-navy-600",
          tone === "green" && "bg-success-bg text-success",
          tone === "blue" && "bg-info-bg text-blue-600",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {icon}
      </div>
    </div>
  );
}

function mapOverviewToSummary(overview: DashboardOverview) {
  return {
    totalGoalLiters: overview.totalGoalLiters,
    totalResultLiters: overview.totalResultLiters,
    totalCommission: overview.totalCommissionAmount,
    totalGoalStock: overview.totalGoalStock,
    totalActiveEmployees: overview.activeEmployeesCount,
    completionLiters: overview.completionPercentLiters.toFixed(1),
    unitsCount: overview.ranking.length,
    ranking: overview.ranking.map((item) => ({
      id: item.unitId,
      name: item.unitName,
      goalLiters: item.goalLiters,
      resultLiters: item.resultLiters,
      completionPercent: item.completionPercent.toFixed(1),
      totalCommission: item.totalCommission,
    })),
    history: overview.history.map((item) => ({
      month: item.label,
      goal: item.goalLiters,
      result: item.resultLiters,
    })),
  };
}

export function DashboardTab({ overview }: { overview: DashboardOverview }) {
  const summary = mapOverviewToSummary(overview);
  const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader
        title="Dashboard da Rede"
        description={`Visão consolidada do desempenho - ${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`}
        actions={
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-1 text-[11px] text-text-secondary">
            <DashboardIcon name="info" className="h-[11px] w-[11px]" />
            Última atualização: {now}
          </span>
        }
      />

      <div className="mb-5 grid gap-4 xl:grid-cols-3">
        <KpiCard
          tone="green"
          label="Comissão Total"
          value={summary.totalCommission > 0 ? formatCurrency(summary.totalCommission) : "R$ 0"}
          helper={summary.totalCommission > 0 ? `${summary.unitsCount} unidades no cálculo` : "Nenhuma comissão calculada"}
          icon={<DashboardIcon name="reports" className="h-[18px] w-[18px]" />}
        />
        <KpiCard
          tone="gold"
          label="Meta Estoque"
          value={summary.totalGoalStock > 0 ? formatCurrency(summary.totalGoalStock) : "—"}
          helper={summary.totalGoalStock > 0 ? `${summary.unitsCount} unidades` : "Nenhuma meta definida"}
          icon={<DashboardIcon name="units" className="h-[18px] w-[18px]" />}
        />
        <KpiCard
          tone="blue"
          label="Funcionários Ativos"
          value={summary.totalActiveEmployees}
          helper={`${summary.unitsCount} unidades na rede`}
          icon={<DashboardIcon name="users" className="h-[18px] w-[18px]" />}
        />
      </div>

      <PanelCard className="mb-4">
        <PanelCardHeader>
          <span className="text-[13px] font-bold tracking-[0.2px] text-text-primary">Meta Geral da Rede × Resultado (Litros)</span>
          <StatusBadge tone={progressTone(summary.completionLiters) as BadgeTone}>{summary.completionLiters}%</StatusBadge>
        </PanelCardHeader>
        <PanelCardBody>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] text-text-muted">Litros vendidos</span>
            <span className="text-[12px] font-bold text-text-primary">
              {summary.totalResultLiters.toLocaleString("pt-BR")} L / {summary.totalGoalLiters.toLocaleString("pt-BR")} L
            </span>
          </div>
          <ProgressBar value={Number(summary.completionLiters)} tone={progressTone(summary.completionLiters)} />
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[12px] text-text-muted">Progresso atual</span>
            <span className="text-[12px] text-text-muted">
              {Number(summary.completionLiters) >= 100
                ? "Meta atingida!"
                : `Faltam ${(summary.totalGoalLiters - summary.totalResultLiters).toLocaleString("pt-BR")} L`}
            </span>
          </div>
        </PanelCardBody>
      </PanelCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <PanelCard>
          <PanelCardHeader>
            <span className="text-[13px] font-bold tracking-[0.2px] text-text-primary">Histórico Meta Litros × Litros Vendidos (6 meses)</span>
          </PanelCardHeader>
          <PanelCardBody>
            <div className="relative h-[180px]">
              <BarChart data={summary.history} />
            </div>
          </PanelCardBody>
        </PanelCard>

        <PanelCard>
          <PanelCardHeader>
            <span className="text-[13px] font-bold tracking-[0.2px] text-text-primary">Ranking de Unidades</span>
          </PanelCardHeader>
          <PanelCardBody className="space-y-0">
            {summary.ranking.map((unit, index) => {
              const completion = unit.completionPercent;
              const toneClass =
                index === 0
                  ? "bg-gold-500/15 text-gold-600"
                  : index === 1
                    ? "bg-slate-500/15 text-slate-500"
                    : index === 2
                      ? "bg-orange-700/12 text-orange-700"
                      : "bg-surface-2 text-text-muted";

              return (
                <div key={unit.id} className="flex items-center gap-3 border-b border-border py-2.5 last:border-none">
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[11px] font-bold ${toneClass}`}>
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-text-primary">{unit.name}</div>
                    <div className="mt-px text-[11px] text-text-muted">
                      {unit.resultLiters.toLocaleString("pt-BR")} L vendidos / {unit.goalLiters.toLocaleString("pt-BR")} L meta
                      {unit.totalCommission > 0 && (
                        <span className="ml-2 font-semibold text-gold-600">Com. {formatCurrency(unit.totalCommission)}</span>
                      )}
                    </div>
                  </div>
                  <StatusBadge tone={progressTone(completion) as BadgeTone}>{completion}%</StatusBadge>
                </div>
              );
            })}
          </PanelCardBody>
        </PanelCard>
      </div>
    </div>
  );
}
