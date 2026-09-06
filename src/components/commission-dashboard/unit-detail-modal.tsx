"use client";

import { useEffect, useState, useTransition } from "react";

import { MONTHS } from "@/data/commission-dashboard";
import { closeMonth, reopenMonth } from "@/features/commission-dashboard/actions/close-month";
import { batchUpsertEmployeeMonthlyRecords, ensureOpenMonthlyRecords, fetchUnitMonthlyDetail } from "@/features/commission-dashboard/actions/unit-detail";
import { calculateCommission, type CommissionRules } from "@/features/commission-dashboard/engine/calculate-commission";
import type { UnitMonthlyDetail, EmployeeRecordRow, EmployeePeriodStatus } from "@/features/commission-dashboard/types/unit-detail-data";
import { formatCurrency } from "@/lib/commission-dashboard";

import { getDisplayedFinalCommission, getZonePresentation, UNIT_DETAIL_COLUMNS, UNIT_DETAIL_COLUMN_WIDTHS, UNIT_DETAIL_GROUP_STARTS } from "./unit-detail-presentation";
import { Modal, NumberInput, ProgressBar, Select, ShellButton, StatusBadge } from "./ui";

type Props = {
  unitId: string;
  unitName: string;
  year: number;
  month: number;
  onClose: () => void;
  onUpdated?: () => void;
};

type Drafts = Record<string, { goal: string; sold: string; abastecimento: string; periodStatus: EmployeePeriodStatus; soldStock: string; stockCommission: string; stockGoalCommission: string; dobras: string }>;

const PERIOD_STATUS_OPTIONS: Array<{ value: EmployeePeriodStatus; label: string }> = [
  { value: "ACTIVE", label: "ATIVO" },
  { value: "VACATION", label: "FÉRIAS" },
  { value: "ABSENCE", label: "FALTA" },
  { value: "MEDICAL_LEAVE", label: "ATESTADO" },
];

function periodStatusLabel(status: EmployeePeriodStatus) {
  return PERIOD_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "ATIVO";
}

function buildDrafts(employees: EmployeeRecordRow[]): Drafts {
  const d: Drafts = {};
  for (const emp of employees) {
    d[emp.employeeId] = {
      goal: String(emp.baseGoalLiters),
      sold: String(emp.soldLiters),
      abastecimento: String(emp.abastecimento),
      periodStatus: emp.periodStatus ?? "ACTIVE",
      soldStock: String(emp.soldStock ?? ""),
      stockCommission: String(emp.stockCommission ?? ""),
      stockGoalCommission: String(emp.baseStockGoal ?? ""),
      dobras: String(emp.dobras ?? ""),
    };
  }
  return d;
}

export function UnitDetailModal({ unitId, unitName, year, month, onClose, onUpdated }: Props) {
  const [data, setData] = useState<UnitMonthlyDetail | null>(null);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [isClosing, startClosing] = useTransition();
  const [isSavingAll, startSavingAll] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      await ensureOpenMonthlyRecords(unitId, year, month);
      const result = await fetchUnitMonthlyDetail(unitId, year, month);
      if (result.success) {
        setData(result.data);
        setDrafts(buildDrafts(result.data.employees));
      } else {
        setError(result.error);
      }
    });
  }, [unitId, year, month]);

  function reload() {
    startTransition(async () => {
      const result = await fetchUnitMonthlyDetail(unitId, year, month);
      if (result.success) {
        setData(result.data);
        setDrafts(buildDrafts(result.data.employees));
      }
    });
  }

  function updateDraft(employeeId: string, field: "goal" | "sold" | "abastecimento" | "periodStatus" | "soldStock" | "stockCommission" | "stockGoalCommission" | "dobras", value: string) {
    setDrafts((prev) => {
      const nextDraft = { ...prev[employeeId] };

      if (field === "periodStatus") {
        nextDraft.periodStatus = value as EmployeePeriodStatus;
      } else {
        nextDraft[field] = value;
      }

      return {
        ...prev,
        [employeeId]: nextDraft,
      };
    });
  }

  function getDirtyInputs() {
    if (!data) return [];
    return data.employees
      .filter((emp) => {
        const draft = drafts[emp.employeeId];
        if (!draft) return false;
        return (
          Number(draft.goal) !== emp.baseGoalLiters ||
          Number(draft.sold) !== emp.soldLiters ||
          Math.trunc(Number(draft.abastecimento) || 0) !== emp.abastecimento ||
          draft.periodStatus !== emp.periodStatus ||
          (draft.soldStock.trim() === "" ? null : Number(draft.soldStock)) !== emp.soldStock ||
          (draft.stockCommission.trim() === "" ? null : Number(draft.stockCommission)) !== emp.stockCommission ||
          (draft.stockGoalCommission.trim() === "" ? null : Number(draft.stockGoalCommission)) !== emp.baseStockGoal ||
          (draft.dobras.trim() === "" ? null : Number(draft.dobras)) !== emp.dobras
        );
      })
      .map((emp) => {
        const draft = drafts[emp.employeeId];
        return {
          employeeId: emp.employeeId,
          unitId,
          year,
          month,
          baseGoalLiters: Number(draft.goal) || 0,
          soldLiters: Number(draft.sold) || 0,
          abastecimento: Math.trunc(Number(draft.abastecimento) || 0),
          goalSource: "MANUAL" as const,
          periodStatus: draft.periodStatus ?? "ACTIVE",
          soldStock: draft.soldStock.trim() === "" ? null : Number(draft.soldStock) || 0,
          stockCommission: draft.stockCommission.trim() === "" ? null : Number(draft.stockCommission) || 0,
          stockGoalCommission:
            draft.stockGoalCommission.trim() === "" ? null : Number(draft.stockGoalCommission) || 0,
          dobras: draft.dobras.trim() === "" ? null : Number(draft.dobras) || 0,
        };
      });
  }

  const hasDirtyRows = getDirtyInputs().length > 0;

  function handleSaveAll() {
    const inputs = getDirtyInputs();
    if (inputs.length === 0) return;
    startSavingAll(async () => {
      const result = await batchUpsertEmployeeMonthlyRecords(inputs);
      if (!result.success) {
        alert(result.error);
        return;
      }
      reload();
      onUpdated?.();
    });
  }

  function handleCloseMonth() {
    if (!confirm("Fechar o mês? As comissões serão calculadas e a edição será bloqueada.")) return;
    startClosing(async () => {
      const dirtyInputs = getDirtyInputs();
      if (dirtyInputs.length > 0) {
        const batchResult = await batchUpsertEmployeeMonthlyRecords(dirtyInputs);
        if (!batchResult.success) {
          alert(batchResult.error);
          return;
        }
      }

      const result = await closeMonth({ unitId, year, month });
      if (!result.success) {
        alert(result.error);
        return;
      }
      reload();
      onUpdated?.();
    });
  }

  function handleReopenMonth() {
    if (!confirm("Reabrir o mês? A edição será desbloqueada.")) return;
    startClosing(async () => {
      const result = await reopenMonth({ unitId, year, month });
      if (!result.success) {
        alert(result.error);
        return;
      }
      reload();
      onUpdated?.();
    });
  }

  const title = `${unitName} — ${MONTHS[month - 1]}/${year}`;

  if (error) {
    return (
      <Modal title={title} onClose={onClose} wide fullscreen>
        <p className="text-[13px] text-danger">{error}</p>
      </Modal>
    );
  }

  if (!data || isLoading) {
    return (
      <Modal title={title} onClose={onClose} wide fullscreen>
        <p className="text-[13px] text-text-muted">Carregando...</p>
      </Modal>
    );
  }

  const completion = data.goalAmount > 0 ? ((data.resultAmount / data.goalAmount) * 100).toFixed(1) : "0.0";
  const isClosed = data.closedAt != null;

  return (
    <Modal
      title={title}
      onClose={onClose}
      wide
      fullscreen
      footer={
        <>
          {!isClosed && hasDirtyRows && !isSavingAll && (
            <ShellButton variant="success" onClick={handleSaveAll}>
              Salvar Todos
            </ShellButton>
          )}
          {isSavingAll && (
            <ShellButton variant="outline" onClick={() => {}}>
              Salvando...
            </ShellButton>
          )}
          {isClosed ? (
            <ShellButton variant="outline" onClick={handleReopenMonth}>
              {isClosing ? "Reabrindo..." : "Reabrir Mês"}
            </ShellButton>
          ) : (
            <ShellButton variant="gold" onClick={handleCloseMonth}>
              {isClosing ? "Fechando..." : "Fechar Mês"}
            </ShellButton>
          )}
          <ShellButton variant="outline" onClick={onClose}>Fechar</ShellButton>
        </>
      }
    >
      {/* ── Resumo ── */}
      <div className="mb-3 grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          { label: "Meta (Litros)", value: data.goalLiters > 0 ? data.goalLiters.toLocaleString("pt-BR") : "—" },
          { label: "Comissão Total", value: data.commissionTotal > 0 ? formatCurrency(data.commissionTotal) : "—" },
        ].map((item) => (
          <div key={item.label} className="rounded-[8px] border border-border bg-surface-2 px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-text-muted">{item.label}</div>
            <div className="mt-1 font-mono text-[13px] font-semibold text-text-primary">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex shrink-0 items-center gap-3">
        <ProgressBar value={Number(completion)} tone={Number(completion) >= 100 ? "green" : Number(completion) >= 70 ? "gold" : "navy"} className="flex-1" />
        <StatusBadge tone={Number(completion) >= 100 ? "green" : Number(completion) >= 70 ? "gold" : "navy"}>{completion}%</StatusBadge>
        {isClosed && <StatusBadge tone="green">Fechado</StatusBadge>}
      </div>

      {/* ── Tabela de funcionários ── */}
      <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain rounded-[8px] border border-border">
        <table className="w-[2275px] min-w-[2275px] table-fixed border-collapse">
          <colgroup>
            {UNIT_DETAIL_COLUMN_WIDTHS.map((width, index) => <col key={UNIT_DETAIL_COLUMNS[index]} style={{ width }} />)}
          </colgroup>
          <thead>
            <tr>
              {UNIT_DETAIL_COLUMNS.map((h) => (
                <th
                  key={h}
                  className={`sticky top-0 z-20 whitespace-normal border-b border-border bg-surface-2 px-2.5 py-2.5 text-left text-[10px] font-bold uppercase leading-tight tracking-[0.5px] text-text-muted ${UNIT_DETAIL_GROUP_STARTS.has(h) ? "border-l-2 border-l-border-dark" : ""} ${h === "Funcionário" ? "left-0 z-30 border-r border-r-border-dark" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.employees.length === 0 ? (
              <tr>
                <td colSpan={UNIT_DETAIL_COLUMNS.length} className="py-8 text-center text-[13px] text-text-muted">
                  Nenhum funcionário ativo nesta unidade.
                </td>
              </tr>
            ) : (
              data.employees.map((emp) => (
                <EmployeeRow
                  key={emp.employeeId}
                  emp={emp}
                  isClosed={isClosed}
                  commissionRules={data.commissionRules}
                  goalDraft={drafts[emp.employeeId]?.goal ?? String(emp.baseGoalLiters)}
                  soldDraft={drafts[emp.employeeId]?.sold ?? String(emp.soldLiters)}
                  abastecimentoDraft={drafts[emp.employeeId]?.abastecimento ?? String(emp.abastecimento)}
                  periodStatusDraft={drafts[emp.employeeId]?.periodStatus ?? "ACTIVE"}
                  soldStockDraft={drafts[emp.employeeId]?.soldStock ?? ""}
                  stockCommissionDraft={drafts[emp.employeeId]?.stockCommission ?? ""}
                  stockGoalCommissionDraft={drafts[emp.employeeId]?.stockGoalCommission ?? ""}
                  dobrasDraft={drafts[emp.employeeId]?.dobras ?? ""}
                  onGoalChange={(v) => updateDraft(emp.employeeId, "goal", v)}
                  onSoldChange={(v) => updateDraft(emp.employeeId, "sold", v)}
                  onAbastecimentoChange={(v) => updateDraft(emp.employeeId, "abastecimento", v)}
                  onPeriodStatusChange={(v) => updateDraft(emp.employeeId, "periodStatus", v)}
                  onSoldStockChange={(v) => updateDraft(emp.employeeId, "soldStock", v)}
                  onStockCommissionChange={(v) => updateDraft(emp.employeeId, "stockCommission", v)}
                  onStockGoalCommissionChange={(v) => updateDraft(emp.employeeId, "stockGoalCommission", v)}
                  onDobrasChange={(v) => updateDraft(emp.employeeId, "dobras", v)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

type RowProps = {
  emp: EmployeeRecordRow;
  isClosed: boolean;
  commissionRules: CommissionRules;
  goalDraft: string;
  soldDraft: string;
  abastecimentoDraft: string;
  periodStatusDraft: EmployeePeriodStatus;
  soldStockDraft: string;
  stockCommissionDraft: string;
  stockGoalCommissionDraft: string;
  dobrasDraft: string;
  onGoalChange: (v: string) => void;
  onSoldChange: (v: string) => void;
  onAbastecimentoChange: (v: string) => void;
  onPeriodStatusChange: (v: EmployeePeriodStatus) => void;
  onSoldStockChange: (v: string) => void;
  onStockCommissionChange: (v: string) => void;
  onStockGoalCommissionChange: (v: string) => void;
  onDobrasChange: (v: string) => void;
};

function EmployeeRow({ emp, isClosed, commissionRules, goalDraft, soldDraft, abastecimentoDraft, periodStatusDraft, soldStockDraft, stockCommissionDraft, stockGoalCommissionDraft, dobrasDraft, onGoalChange, onSoldChange, onAbastecimentoChange, onPeriodStatusChange, onSoldStockChange, onStockCommissionChange, onStockGoalCommissionChange, onDobrasChange }: RowProps) {
  const editable = !isClosed;
  const litersInputClass =
    "w-full min-w-0 !px-1.5 !py-1.5 text-right font-mono tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  const currentSold = Number(soldDraft) || 0;
  const preview = editable ? calculateCommission({
    employmentType: emp.employmentType === "experiencia" ? "PROBATION" : "PERMANENT",
    employeeShift: emp.employeeShift === "noturno" ? "NIGHTTIME" : "DAYTIME",
    baseGoalLiters: Number(goalDraft) || 0,
    soldLiters: currentSold,
    unitMetLitersGoal: false,
    soldStock: Number(soldStockDraft) || null,
    stockGoal: Number(stockGoalCommissionDraft) || null,
    stockBaseCommission: Number(stockCommissionDraft) || 0,
    dobras: Number(dobrasDraft) || 0,
  }, commissionRules) : null;
  const effectiveGoal = preview?.effectiveGoalLiters ?? emp.finalGoalLiters;
  const litersAchievement = preview?.achievementPercentage ?? emp.achievementPercentage;
  const litersZone = preview?.litersZone ?? emp.litersZone;
  const stockAchievement = preview ? preview.stockAchievement * 100 : emp.stockAchievementPercentage;
  const stockZone = preview?.stockZone ?? emp.stockZone;
  const litersPresentation = getZonePresentation(litersAchievement, litersZone, commissionRules.zones);
  const stockPresentation = getZonePresentation(stockAchievement, stockZone, commissionRules.zones);
  const pctLabel = litersAchievement.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const stockPctLabel = stockAchievement.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const isIneligible = isClosed && emp.commissionEligible === false;
  const eligibilityTooltip = isIneligible
    ? `Não elegível para comissão\nAtingimento: ${pctLabel}%\nMínimo exigido: ${(emp.minimumEligibilityPercentage ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
    : undefined;
  const displayedFinalCommission = getDisplayedFinalCommission({
    persistedFinalTotalCommission: emp.finalTotalCommission,
    previewFinalTotalCommission: preview?.finalTotalCommission,
  });

  const cellBase = "border-b border-border px-2.5 py-2.5 text-[12px] group-hover:bg-surface-2";

  return (
    <tr className="group">
      <td className={`${cellBase} sticky left-0 z-10 border-r border-r-border-dark bg-surface font-semibold leading-snug text-text-primary`}>
        <span className="line-clamp-2 break-words" title={emp.name}>{emp.name}</span>
        {!emp.hasRecord && (
          <span className="ml-1.5 text-[10px] font-normal text-text-muted">(sem registro)</span>
        )}
      </td>
      <td className={`${cellBase} whitespace-nowrap`}>
        {editable ? (
          <Select
            value={periodStatusDraft}
            onChange={(event) => onPeriodStatusChange(event.target.value as EmployeePeriodStatus)}
            className="w-full min-w-0 !px-1.5 !py-1.5 text-[11px]"
          >
            {PERIOD_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : (
          <StatusBadge tone={emp.periodStatus === "ACTIVE" ? "green" : "gold"}>
            {periodStatusLabel(emp.periodStatus)}
          </StatusBadge>
        )}
      </td>
      <td className={`${cellBase} whitespace-nowrap`}>
        {editable ? (
          <NumberInput
            value={abastecimentoDraft}
            onValueChange={onAbastecimentoChange}
            maxDecimalDigits={0}
            className={`${litersInputClass} text-[12px]`}
          />
        ) : (
          <span className="font-mono tabular-nums text-[12px]">
            {emp.abastecimento > 0
              ? emp.abastecimento.toLocaleString("pt-BR")
              : "—"}
          </span>
        )}
      </td>
      <td className={`${cellBase} whitespace-nowrap`}>
        <StatusBadge tone={emp.employmentType === "efetivado" ? "navy" : "gold"}>
          {emp.employmentType === "efetivado" ? "Efetivado" : "Experiência"}
        </StatusBadge>
      </td>
      <td className={`${cellBase} text-[12px] text-text-secondary`}>
        {emp.employeeShift === "diurno" ? "Diurno" : "Noturno"}
      </td>
      <td className={`${cellBase} border-l-2 border-l-border-dark whitespace-nowrap`}>
        {editable ? (
          <NumberInput
            value={goalDraft}

            onValueChange={onGoalChange}
            maxDecimalDigits={3}
            className={`${litersInputClass} text-[12px]`}
          />
        ) : (
          <span className="font-mono tabular-nums text-[12px]">
            {effectiveGoal > 0
              ? effectiveGoal.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 })
              : "—"}
          </span>
        )}
      </td>
      <td className={`${cellBase} whitespace-nowrap`}>
        {editable ? (
          <NumberInput
            value={soldDraft}

            onValueChange={onSoldChange}
            maxDecimalDigits={3}
            className={`${litersInputClass} text-[12px]`}
          />
        ) : (
          <span className="font-mono tabular-nums text-[12px]">
            {emp.soldLiters > 0
              ? emp.soldLiters.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 })
              : "—"}
          </span>
        )}
      </td>
      <td className={`${cellBase} whitespace-nowrap`}>
        <span
          className="inline-flex max-w-full"
          title={eligibilityTooltip}
          aria-label={eligibilityTooltip ?? `Atingimento: ${pctLabel}%`}
        >
          <StatusBadge tone={litersPresentation.tone} className="whitespace-nowrap font-mono tabular-nums">
            {pctLabel}%
          </StatusBadge>
        </span>
      </td>
      <td className={`${cellBase} whitespace-nowrap`}>
        <StatusBadge tone={litersPresentation.tone}>{litersPresentation.label}</StatusBadge>
      </td>
      <td className={`${cellBase} border-l-2 border-l-border-dark whitespace-nowrap`}>
        {editable ? (
          <NumberInput
            value={stockGoalCommissionDraft}
            onValueChange={onStockGoalCommissionChange}
            className={`${litersInputClass} text-[12px]`}
          />
        ) : (
          <span className="font-mono tabular-nums text-[12px]">
            {emp.stockGoalCommission !== null && emp.stockGoalCommission > 0 ? formatCurrency(emp.stockGoalCommission) : "—"}
          </span>
        )}
      </td>
      <td className={`${cellBase} whitespace-nowrap`}>
        {editable ? (
          <NumberInput
            value={soldStockDraft}
            onValueChange={onSoldStockChange}
            className={`${litersInputClass} text-[12px]`}
          />
        ) : (
          <span className="font-mono tabular-nums text-[12px]">
            {emp.soldStock !== null && emp.soldStock > 0 ? formatCurrency(emp.soldStock) : "—"}
          </span>
        )}
      </td>
      <td className={`${cellBase} whitespace-nowrap`}>
        <StatusBadge tone={stockPresentation.tone} className="whitespace-nowrap font-mono tabular-nums">
          {stockPctLabel}%
        </StatusBadge>
      </td>
      <td className={`${cellBase} whitespace-nowrap`}>
        <StatusBadge tone={stockPresentation.tone}>{stockPresentation.label}</StatusBadge>
      </td>
      <td className={`${cellBase} whitespace-nowrap`}>
        {editable ? (
          <NumberInput
            value={stockCommissionDraft}
            onValueChange={onStockCommissionChange}
            className={`${litersInputClass} text-[12px]`}
          />
        ) : (
          <span className="font-mono tabular-nums text-[12px]">
            {emp.stockCommission !== null && emp.stockCommission > 0 ? formatCurrency(emp.stockCommission) : "—"}
          </span>
        )}
      </td>
      <td className={`${cellBase} whitespace-nowrap border-l-2 border-l-border-dark font-mono tabular-nums`}>
        {isIneligible ? formatCurrency(0) : preview ? formatCurrency(preview.baseCommission) : emp.baseCommission !== null ? formatCurrency(emp.baseCommission) : "—"}
      </td>
      <td className={`${cellBase} whitespace-nowrap`}>
        {editable ? (
          <NumberInput
            value={dobrasDraft}
            onValueChange={onDobrasChange}
            className={`${litersInputClass} text-[12px]`}
          />
        ) : (
          <span className="font-mono tabular-nums text-[12px]">
            {emp.dobras !== null && emp.dobras > 0 ? formatCurrency(emp.dobras) : "—"}
          </span>
        )}
      </td>
      <td className={`${cellBase} whitespace-nowrap font-mono tabular-nums`}>
        {!isIneligible && (preview?.bonusAmount ?? emp.bonusAmount ?? 0) > 0 ? (
          <span className="text-success">{formatCurrency(preview?.bonusAmount ?? emp.bonusAmount ?? 0)}</span>
        ) : "—"}
      </td>
      <td className={`${cellBase} whitespace-nowrap font-mono text-[13px] font-bold tabular-nums text-gold-600`}>
        {displayedFinalCommission !== null ? formatCurrency(displayedFinalCommission) : "—"}
      </td>
    </tr>
  );
}
