import type { DashboardOverview } from "@/features/commission-dashboard/types/dashboard-data";
import { MONTHS } from "@/data/commission-dashboard";
import { formatCurrency } from "@/lib/commission-dashboard";

import { BarChart } from "../chart";

function formatLiters(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L`;
}

function Metric({ label, value, detail, emphasis = false }: { label: string; value: string | number; detail?: string; emphasis?: boolean }) {
  return (
    <div className="min-w-0 px-4 py-3 first:pl-0 lg:border-l lg:border-white/10 lg:first:border-l-0 lg:first:pl-0">
      <p className="text-[9px] font-bold uppercase tracking-[1.5px] text-white/40">{label}</p>
      <p className={`mt-1 font-mono font-semibold tracking-[-0.6px] ${emphasis ? "text-[30px] text-gold-300" : "text-[22px] text-white"}`}>{value}</p>
      {detail ? <p className="mt-1 truncate text-[10px] text-white/42">{detail}</p> : null}
    </div>
  );
}

function GoalScale({ completion, result, goal }: { completion: number; result: number; goal: number }) {
  const marker = Math.max(0, Math.min(100, completion / 1.5));
  return (
    <section className="border-b border-border-dark py-6">
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div><p className="text-[9px] font-bold uppercase tracking-[1.5px] text-text-muted">Escala de atingimento</p><h2 className="mt-1 text-[15px] font-bold text-text-primary">Resultado da rede × zonas de desempenho</h2></div>
        <div className="font-mono text-[12px] text-text-secondary"><strong className="text-text-primary">{formatLiters(result)}</strong> de {formatLiters(goal)}</div>
      </div>
      <div className="relative pt-6">
        <div className="flex h-3 overflow-hidden bg-border">
          <div className="w-2/3 bg-navy-700" />
          <div className="w-[3.33%] bg-gold-500" />
          <div className="w-[20%] bg-success" />
          <div className="flex-1 bg-blue-700" />
        </div>
        <div className="absolute top-0 -translate-x-1/2" style={{ left: `${marker}%` }}>
          <span className="block whitespace-nowrap bg-navy-950 px-2 py-1 font-mono text-[10px] font-bold text-white">{completion.toFixed(1)}%</span>
          <span className="mx-auto block h-5 w-px bg-navy-950" />
        </div>
        <div className="relative mt-2 h-5 text-[9px] font-semibold uppercase tracking-[0.7px] text-text-muted">
          <span className="absolute left-0">0</span><span className="absolute left-2/3 -translate-x-1/2 text-text-primary">Meta · 100%</span><span className="absolute left-[70%]">Verde</span><span className="absolute right-0 text-blue-700">Azul · 135%+</span>
        </div>
      </div>
    </section>
  );
}

export function DashboardTab({ overview }: { overview: DashboardOverview }) {
  const completion = overview.completionPercentLiters;
  const belowGoal = overview.ranking.filter((unit) => unit.completionPercent < 100).length;
  const leadingUnit = overview.ranking[0];

  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="relative overflow-hidden bg-navy-950 px-5 py-5 text-white lg:px-7 lg:py-6">
        <div className="absolute inset-y-0 left-0 w-[3px] bg-gold-400" />
        <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
          <div><span className="text-[9px] font-bold uppercase tracking-[1.8px] text-gold-400">Painel executivo</span><span className="ml-3 text-[10px] uppercase tracking-[1px] text-white/35">{MONTHS[overview.period.month - 1]} / {overview.period.year}</span></div>
          <span className="text-[9px] font-semibold uppercase tracking-[1px] text-white/35">Rede consolidada</span>
        </div>
        <div className="grid divide-y divide-white/10 lg:grid-cols-[1.25fr_1fr_1.35fr_.75fr_.65fr] lg:divide-x lg:divide-y-0">
          <Metric label="Comissão projetada" value={overview.totalCommissionAmount > 0 ? formatCurrency(overview.totalCommissionAmount) : "R$ 0"} detail="Cálculo da competência" emphasis />
          <Metric label="Atingimento" value={`${completion.toFixed(1)}%`} detail={completion >= 100 ? "Meta da rede atingida" : "Em evolução"} />
          <Metric label="Volume vendido" value={formatLiters(overview.totalResultLiters)} detail={`Meta ${formatLiters(overview.totalGoalLiters)}`} />
          <Metric label="Equipe" value={overview.activeEmployeesCount} detail="ativos" />
          <Metric label="Unidades" value={overview.ranking.length} detail="na operação" />
        </div>
      </section>

      <GoalScale completion={completion} result={overview.totalResultLiters} goal={overview.totalGoalLiters} />

      <div className="grid gap-8 py-7 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.8fr)]">
        <section className="min-w-0">
          <div className="mb-5 flex items-end justify-between border-b border-border-dark pb-3">
            <div><p className="text-[9px] font-bold uppercase tracking-[1.5px] text-text-muted">Desempenho da rede</p><h2 className="mt-1 text-[17px] font-bold text-text-primary">Meta e resultado em litros</h2></div>
            <span className="text-[10px] text-text-muted">Últimas {overview.history.length} competências</span>
          </div>
          <div className="h-[290px]"><BarChart data={overview.history.map((item) => ({ month: item.label, goal: item.goalLiters, result: item.resultLiters }))} /></div>
        </section>

        <aside className="border-l border-border-dark pl-0 xl:pl-7">
          <div className="mb-3 flex items-end justify-between border-b border-border-dark pb-3"><div><p className="text-[9px] font-bold uppercase tracking-[1.5px] text-text-muted">Pulso operacional</p><h2 className="mt-1 text-[17px] font-bold text-text-primary">Unidades</h2></div><span className="text-[10px] text-text-muted">{belowGoal} abaixo da meta</span></div>
          <div>
            {overview.ranking.map((unit, index) => (
              <div key={unit.unitId} className="grid grid-cols-[28px_minmax(0,1fr)_52px] items-center gap-3 border-b border-border py-3 last:border-0">
                <span className="font-mono text-[11px] font-bold text-text-muted">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0"><div className="flex items-center justify-between gap-3"><strong className="truncate text-[12px] text-text-primary">{unit.unitName}</strong></div><div className="mt-1.5 h-1 bg-border"><div className={`h-full ${unit.completionPercent >= 100 ? "bg-success" : "bg-gold-500"}`} style={{ width: `${Math.min(100, unit.completionPercent)}%` }} /></div><p className="mt-1 font-mono text-[9px] text-text-muted">{formatLiters(unit.resultLiters)} / {formatLiters(unit.goalLiters)}</p></div>
                <span className={`text-right font-mono text-[12px] font-bold ${unit.completionPercent >= 100 ? "text-success" : "text-text-secondary"}`}>{unit.completionPercent.toFixed(1)}%</span>
              </div>
            ))}
          </div>
          {leadingUnit ? <div className="mt-5 border-l-2 border-gold-500 pl-3"><p className="text-[9px] font-bold uppercase tracking-[1px] text-text-muted">Destaque da competência</p><p className="mt-1 text-[12px] text-text-secondary"><strong className="text-text-primary">{leadingUnit.unitName}</strong> lidera com {leadingUnit.completionPercent.toFixed(1)}% de atingimento.</p></div> : null}
        </aside>
      </div>
    </div>
  );
}
