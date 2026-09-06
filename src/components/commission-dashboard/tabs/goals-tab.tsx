"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { fetchGoalsData, updateUnitMonthlyMetric } from "@/features/commission-dashboard/actions/goals";
import type { GoalsOverview, GoalsUnitRow } from "@/features/commission-dashboard/types/goals-data";
import { MONTHS, REPORT_YEARS } from "@/data/commission-dashboard";
import { formatCurrency, formatPercentPtBr, getUnitPerformancePercent, progressTone } from "@/lib/commission-dashboard";

import { DashboardIcon } from "../icons";
import { type BadgeTone, NumberInput, PageHeader, ProgressBar, Select, ShellButton, StatusBadge } from "../ui";
import { UnitDetailModal } from "../unit-detail-modal";

export function GoalsTab({ overview: initialOverview }: { overview: GoalsOverview }) {
  const percent = (value: number, goal: number) => {
    if (!goal || goal <= 0) return "0,0";

    return ((value / goal) * 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  };

  const router = useRouter();
  const [overview, setOverview] = useState(initialOverview);
  const [selectedMonth, setSelectedMonth] = useState(initialOverview.period.month - 1);
  const [selectedYear, setSelectedYear] = useState(initialOverview.period.year);
  const [loadedMonth, setLoadedMonth] = useState(initialOverview.period.month);
  const [loadedYear, setLoadedYear] = useState(initialOverview.period.year);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ goal: "", result: "", goalLiters: "", goalStock: "", resultLiters: "", resultStock: "" });
  const [isSaving, startTransition] = useTransition();
  const [isLoading, startLoadTransition] = useTransition();
  const [detailUnit, setDetailUnit] = useState<{ unitId: string; unitName: string } | null>(null);

  async function reloadOverview(year: number, month: number) {
    const data = await fetchGoalsData({ year, month });
    setOverview(data);
    setLoadedMonth(month);
    setLoadedYear(year);
  }

  useEffect(() => {
    const dbMonth = selectedMonth + 1;

    if (dbMonth === loadedMonth && selectedYear === loadedYear) {
      return;
    }

    setEditingId(null);
    startLoadTransition(async () => {
      try {
        await reloadOverview(selectedYear, dbMonth);
      } catch {
        alert("Erro ao carregar dados do período.");
      }
    });
  }, [selectedMonth, selectedYear, loadedMonth, loadedYear]);

  const units = overview?.units ?? [];
  const totalCommission = units.reduce((sum, unit) => sum + unit.totalCommission, 0);
  const editableInputClass = "w-[170px] min-w-[170px] whitespace-nowrap font-mono tabular-nums";

  function getPerformance(unit: GoalsUnitRow): { value: string | null; source: "Financeiro" | "Operacional" | null } {
    const financialGoal = unit.goalAmount;
    const financialResult = unit.resultAmount;
    if (financialGoal > 0 && financialResult > 0) {
      return { value: percent(financialResult, financialGoal), source: "Financeiro" };
    }

    const operationalPercents: number[] = [];

    if (unit.goalLiters > 0 && unit.resultLiters >= 0) {
      operationalPercents.push((unit.resultLiters / unit.goalLiters) * 100);
    }

    if (unit.goalStock > 0 && unit.resultStock >= 0) {
      operationalPercents.push((unit.resultStock / unit.goalStock) * 100);
    }

    if (operationalPercents.length === 0) {
      return { value: null, source: null };
    }

    const average = operationalPercents.reduce((sum, value) => sum + value, 0) / operationalPercents.length;
    return { value: average.toFixed(1), source: "Operacional" };
  }

  function startEditing(unit: GoalsUnitRow) {
    setEditingId(unit.unitId);
    setDraft({ goal: String(unit.goalAmount), result: String(unit.resultAmount), goalLiters: String(unit.goalLiters), goalStock: String(unit.goalStock), resultLiters: String(unit.resultLiters), resultStock: String(unit.resultStock) });
  }

  function cancelEditing() {
    setEditingId(null);
    setDraft({ goal: "", result: "", goalLiters: "", goalStock: "", resultLiters: "", resultStock: "" });
  }

  function saveEditing(unitId: string) {
    const dbMonth = selectedMonth + 1;

    startTransition(async () => {
      const result = await updateUnitMonthlyMetric({
        unitId,
        year: selectedYear,
        month: dbMonth,
        goalAmount: Number(draft.goal) || 0,
        resultAmount: Number(draft.result) || 0,
        goalLiters: Number(draft.goalLiters) || 0,
        goalStock: Number(draft.goalStock) || 0,
        resultLiters: Number(draft.resultLiters) || 0,
        resultStock: Number(draft.resultStock) || 0,
      });

      if (!result.success) {
        alert(result.error);
        return;
      }

      setEditingId(null);
      setDraft({ goal: "", result: "", goalLiters: "", goalStock: "", resultLiters: "", resultStock: "" });

      try {
        await reloadOverview(selectedYear, dbMonth);
      } catch {
        router.refresh();
      }
    });
  }

  return (
    <div>
      <PageHeader
        title="Metas e Comissões"
        description="Defina metas e resultados por unidade. O sistema calcula as comissões automaticamente."
        actions={
          <>
            <Select className="w-[130px]" value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))}>
              {MONTHS.map((month, index) => (
                <option key={month} value={index}>
                  {month}
                </option>
              ))}
            </Select>
            <Select className="w-[90px]" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
              {REPORT_YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
            {isLoading && <span className="text-[11px] text-text-muted">Carregando...</span>}
          </>
        }
      />

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <div className="rounded-[10px] border border-border bg-surface shadow-panel">
          <div className="p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[1px] text-text-muted">Comissão Total a Distribuir</div>
            <div className="mt-2 font-mono text-[18px] font-semibold text-gold-600">{formatCurrency(totalCommission)}</div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-border bg-surface shadow-panel">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="text-[13px] font-bold tracking-[0.2px] text-text-primary">
            Metas por Unidade — {MONTHS[selectedMonth]}/{selectedYear}
          </span>
          {units.some((u) => u.closedAt != null) && (
            <StatusBadge tone="green">Período com fechamentos</StatusBadge>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1360px] border-collapse">
            <thead>
              <tr>
                {[
                  "Unidade",
                  "Meta (Litros)",
                  "Resultado Litragem",
                  "Meta Estoque",
                  "Resultado Estoque",
                  "% Desempenho",
                  "Comissão Total",
                  "Func. Ativos",
                  "Comissão / Func.",
                  "Ações",
                ].map((title) => (
                  <th
                    key={title}
                    className="border-b border-border bg-surface-2 px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[1.2px] text-text-muted"
                  >
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3.5 py-8 text-center text-[12px] text-text-muted">
                    Nenhuma meta cadastrada para {MONTHS[selectedMonth]}/{selectedYear}.
                  </td>
                </tr>
              ) : null}
              {units.map((unit) => {
                const performance = getUnitPerformancePercent({
                  goalAmount: unit.goalAmount,
                  resultAmount: unit.resultAmount,
                  goalLiters: unit.goalLiters,
                  resultLiters: unit.resultLiters,
                  goalStock: unit.goalStock,
                  resultStock: unit.resultStock,
                });
                const performanceLabel = performance.value;
                const isClosed = unit.closedAt != null;
                const isEditing = !isClosed && editingId === unit.unitId;

                return (
                  <tr key={unit.unitId} className="group">
                    <td className="border-b border-border px-3.5 py-3 text-[13px] font-semibold text-text-primary group-hover:bg-surface-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-left text-navy-600 underline-offset-2 hover:underline"
                          onClick={() => setDetailUnit({ unitId: unit.unitId, unitName: unit.unitName })}
                        >
                          {unit.unitName}
                        </button>
                        {isClosed && <StatusBadge tone="green">Fechado</StatusBadge>}
                      </div>
                    </td>
                    <td className="border-b border-border px-3.5 py-3 whitespace-nowrap group-hover:bg-surface-2">
                      {isEditing ? (
                        <NumberInput
                          value={draft.goalLiters}
                          disabled={isSaving}
                          onValueChange={(value) => setDraft((current) => ({ ...current, goalLiters: value }))}
                          className="w-[120px] min-w-[120px] font-mono tabular-nums"
                        />
                      ) : (
                        <span className="font-mono text-[12px]">{unit.goalLiters > 0 ? unit.goalLiters.toLocaleString("pt-BR") : "—"}</span>
                      )}
                    </td>
                    <td className="border-b border-border px-3.5 py-3 whitespace-nowrap group-hover:bg-surface-2">
                      {isEditing ? (
                        <NumberInput
                          value={draft.resultLiters}
                          disabled={isSaving}
                          onValueChange={(value) => setDraft((current) => ({ ...current, resultLiters: value }))}
                          className="w-[120px] min-w-[120px] font-mono tabular-nums"
                        />
                      ) : (
                        <span className="font-mono text-[12px]">{unit.resultLiters > 0 ? unit.resultLiters.toLocaleString("pt-BR") : "—"}</span>
                      )}
                    </td>
                    {/* Meta Estoque */}
                    <td className="border-b border-border px-3.5 py-3 whitespace-nowrap group-hover:bg-surface-2">
                      {isEditing ? (
                        <NumberInput
                          value={draft.goalStock}
                          disabled={isSaving}
                          onValueChange={(value) => setDraft((current) => ({ ...current, goalStock: value }))}
                          className="w-[120px] min-w-[120px] font-mono tabular-nums"
                        />
                      ) : (
                        <span className="font-mono text-[12px]">{unit.goalStock > 0 ? formatCurrency(unit.goalStock) : "—"}</span>
                      )}
                    </td>
                    {/* Resultado Estoque */}
                    <td className="border-b border-border px-3.5 py-3 whitespace-nowrap group-hover:bg-surface-2">
                      {isEditing ? (
                        <NumberInput
                          value={draft.resultStock}
                          disabled={isSaving}
                          onValueChange={(value) => setDraft((current) => ({ ...current, resultStock: value }))}
                          className="w-[120px] min-w-[120px] font-mono tabular-nums"
                        />
                      ) : (
                        <span className="font-mono text-[12px]">{unit.resultStock > 0 ? formatCurrency(unit.resultStock) : "—"}</span>
                      )}
                    </td>
                    <td className="border-b border-border px-3.5 py-3 group-hover:bg-surface-2">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={Number(performanceLabel)} tone={progressTone(performanceLabel)} className="w-[55px]" />
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge tone={progressTone(performanceLabel) as BadgeTone}>
                            {`${formatPercentPtBr(performance.value)}%`}
                          </StatusBadge>
                          {performance.source && (
                            <span className="text-[10px] text-text-muted">{performance.source}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-border px-3.5 py-3 group-hover:bg-surface-2">
                      {unit.totalCommission > 0 ? (
                        <div>
                          <div className="font-mono text-[12px] font-bold text-gold-600">{formatCurrency(unit.totalCommission)}</div>
                          <div className="mt-0.5 text-[10px] text-text-muted">
                            Base {formatCurrency(unit.totalBaseCommission)}
                            {unit.bonusApplied && <span className="ml-1 text-success">+ {formatCurrency(unit.totalBonusAmount)}</span>}
                          </div>
                        </div>
                      ) : (
                        <span className="font-mono text-[12px] font-bold text-gold-600">—</span>
                      )}
                    </td>
                    <td className="border-b border-border px-3.5 py-3 group-hover:bg-surface-2">
                      <StatusBadge tone="navy">{unit.activeEmployeesCount}</StatusBadge>
                    </td>
                    <td className="border-b border-border px-3.5 py-3 font-mono text-[12px] font-semibold group-hover:bg-surface-2">
                      {unit.totalCommission > 0 && unit.activeEmployeesCount > 0
                        ? formatCurrency(unit.totalCommission / unit.activeEmployeesCount)
                        : "—"}
                    </td>
                    <td className="border-b border-border px-3.5 py-3 group-hover:bg-surface-2">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <ShellButton variant="success" size="sm" onClick={() => saveEditing(unit.unitId)}>
                            <DashboardIcon name="check" className="h-[14px] w-[14px]" />
                            {isSaving ? "Salvando..." : "Salvar"}
                          </ShellButton>
                          <ShellButton variant="outline" size="sm" onClick={cancelEditing}>
                            Cancelar
                          </ShellButton>
                        </div>
                      ) : isClosed ? (
                        <StatusBadge tone="gray">Bloqueado</StatusBadge>
                      ) : (
                        <ShellButton variant="outline" size="sm" onClick={() => startEditing(unit)}>
                          <DashboardIcon name="edit" className="h-[14px] w-[14px]" />
                          Editar
                        </ShellButton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {detailUnit && (
        <UnitDetailModal
          unitId={detailUnit.unitId}
          unitName={detailUnit.unitName}
          year={selectedYear}
          month={selectedMonth + 1}
          onUpdated={() => {
            void reloadOverview(selectedYear, selectedMonth + 1).catch(() => {
              router.refresh();
            });
          }}
          onClose={() => setDetailUnit(null)}
        />
      )}
    </div>
  );
}
