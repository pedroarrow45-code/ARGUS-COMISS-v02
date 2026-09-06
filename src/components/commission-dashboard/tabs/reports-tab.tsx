"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { fetchReportsData } from "@/features/commission-dashboard/actions/reports";
import type { ReportsOverview } from "@/features/commission-dashboard/types/reports-data";
import { MONTHS, REPORT_YEARS } from "@/data/commission-dashboard";
import {
  buildCsv,
  buildPrintHtml,
  downloadCsv,
  formatPercentPtBr,
  formatCurrency,
  formatRawNumber,
  getUnitPerformancePercent,
  getReportUnitGoalLiters,
  initials,
  openPrintWindow,
  progressTone,
} from "@/lib/commission-dashboard";
import type { Unit } from "@/types/commission-dashboard";

import { DashboardIcon } from "../icons";
import { AlertBox, Avatar, PageHeader, Select, ShellButton, StatusBadge } from "../ui";

function formatCommissionCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/\u00A0/g, " ");
}


// Vínculo: baseia-se no tipo de contrato (PERMANENT → Efetivado, PROBATION → Experiência).
function vinculoTone(status: "experiencia" | "efetivado") {
  return status === "efetivado" ? ("navy" as const) : ("gold" as const);
}

function vinculoLabel(status: "experiencia" | "efetivado") {
  return status === "efetivado" ? "Efetivado" : "Experiência";
}

function getEmployeeRankingCommission(employee: ReportsOverview["employees"][number]) {
  return employee.rankingCommission;
}

function getPeriodStatusLabel(status: ReportsOverview["employees"][number]["periodStatus"]) {
  if (status === "VACATION") return "FÉRIAS";
  if (status === "ABSENCE") return "FALTA";
  if (status === "MEDICAL_LEAVE") return "ATESTADO";
  return "NÃO BATEU";
}

function hasEmployeePeriodResult(employee: ReportsOverview["employees"][number]) {
  return (
    employee.soldLiters > 0 ||
    employee.soldStock > 0 ||
    employee.rankingCommission > 0 ||
    employee.totalCommission > 0 ||
    employee.correctedLiters > 0 ||
    employee.correctedStock > 0
  );
}

export function ReportsTab({ initialOverview }: { initialOverview: ReportsOverview }) {
  const [overview, setOverview] = useState(initialOverview);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedUnitId, setSelectedUnitId] = useState<string>("all");
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const reportRef = useRef<HTMLDivElement | null>(null);
  const unitReportRefs = useRef<Record<string, HTMLElement | null>>({});

  const allUnits = overview.units;
  const allEmployees = overview.employees;

  const units = selectedUnitId === "all" ? allUnits : allUnits.filter((u) => u.id === selectedUnitId);
  const employees = selectedUnitId === "all" ? allEmployees : allEmployees.filter((e) => units.some((u) => u.id === e.unitId));

  useEffect(() => {
    const dbMonth = selectedMonth + 1;

    if (dbMonth === overview.period.month && selectedYear === overview.period.year) {
      return;
    }

    startTransition(async () => {
      try {
        const data = await fetchReportsData({ year: selectedYear, month: dbMonth });
        setOverview(data);
      } catch {
        alert("Erro ao carregar dados do período.");
      }
    });
  }, [selectedMonth, selectedYear, overview.period.month, overview.period.year, startTransition]);

  const totalCommission = useMemo(
    () => units.reduce((sum, unit) => sum + unit.totalCommission, 0),
    [units],
  );

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  }

  function toggleUnitExpand(unitId: string) {
    setExpandedUnits((prev) => ({ ...prev, [unitId]: !prev[unitId] }));
  }

  function exportFullPdf() {
    openPrintWindow(
      buildPrintHtml(
        units,
        employees,
        selectedMonth,
        selectedYear,
        `Relatório Completo - ${MONTHS[selectedMonth]}/${selectedYear}`,
      ),
    );
    showToast("PDF completo aberto para impressão.");
  }

  function exportFullCsv() {
    downloadCsv(
      buildCsv(units, employees, selectedMonth, selectedYear),
      `argus-comiss-rede-horizonte-${MONTHS[selectedMonth].toLowerCase()}-${selectedYear}.csv`,
    );
    showToast("CSV completo baixado com sucesso.");
  }

  async function exportFullJpg() {
    if (!reportRef.current) {
      showToast("Não foi possível capturar o relatório.");
      return;
    }

    try {
      const { toJpeg } = await import("html-to-image");
      const dataUrl = await toJpeg(reportRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `relatorio-comissoes-completo-${MONTHS[selectedMonth].toLowerCase()}-${selectedYear}.jpg`;
      link.click();

      showToast("Imagem JPG gerada com sucesso.");
    } catch {
      showToast("Erro ao exportar imagem JPG.");
    }
  }

  function exportUnitPdf(unit: Unit) {
    openPrintWindow(
      buildPrintHtml(
        [unit],
        employees,
        selectedMonth,
        selectedYear,
        `Relatório - ${unit.name} - ${MONTHS[selectedMonth]}/${selectedYear}`,
      ),
    );
    showToast(`PDF da unidade "${unit.name}" aberto.`);
  }

  function exportUnitCsv(unit: Unit) {
    downloadCsv(
      buildCsv([unit], employees, selectedMonth, selectedYear),
      `argus-comiss-${unit.name.replace(/\s+/g, "-").toLowerCase()}-${MONTHS[selectedMonth].toLowerCase()}-${selectedYear}.csv`,
    );
    showToast(`CSV da unidade "${unit.name}" baixado.`);
  }

  function normalizeFileName(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
  }

  async function exportUnitReportAsJpeg(unit: Unit) {
    const exportHost = document.createElement("div");
    exportHost.style.position = "fixed";
    exportHost.style.left = "-20000px";
    exportHost.style.top = "0";
    exportHost.style.width = "1800px";
    exportHost.style.background = "#ffffff";
    exportHost.style.zIndex = "-1";
    exportHost.style.padding = "0";
    document.body.appendChild(exportHost);
    try {
      const html = buildPrintHtml(
        [unit],
        employees,
        selectedMonth,
        selectedYear,
        `Relatório - ${unit.name} - ${MONTHS[selectedMonth]}/${selectedYear}`,
      );
      const parser = new DOMParser();
      const parsed = parser.parseFromString(html, "text/html");
      const styles = parsed.head.querySelector("style");
      const reportPage = parsed.body.querySelector(".report-page");
      if (!reportPage || !styles) {
        throw new Error("report-page-not-found");
      }

      const exportNode = document.createElement("div");
      exportNode.style.background = "#ffffff";
      exportNode.style.padding = "24px";
      exportNode.style.width = "1700px";
      exportNode.style.fontFamily = "'IBM Plex Sans', Arial, sans-serif";
      exportNode.innerHTML = `
        <style>${styles.textContent ?? ""}</style>
        ${reportPage.outerHTML}
      `;
      exportHost.appendChild(exportNode);

      const { toJpeg } = await import("html-to-image");
      const dataUrl = await toJpeg(exportNode, {
        quality: 0.95,
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `relatorio-comissoes-${normalizeFileName(unit.name)}-${MONTHS[selectedMonth].toLowerCase()}-${selectedYear}.jpg`;
      link.click();

      showToast(`JPG da unidade "${unit.name}" baixado.`);
    } catch {
      showToast(`Erro ao exportar imagem da unidade "${unit.name}".`);
    } finally {
      document.body.removeChild(exportHost);
    }
  }

  return (
    <div>
      <PageHeader
        title="Relatórios e Exportação"
        description="Exporte relatórios completos da rede ou individualmente por unidade"
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
            <Select className="w-[170px]" value={selectedUnitId} onChange={(event) => setSelectedUnitId(event.target.value)}>
              <option value="all">Todas as unidades</option>
              {allUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </Select>
            <ShellButton variant="outline" onClick={exportFullCsv}>
              <DashboardIcon name="table" className="h-[14px] w-[14px]" />
              CSV Completo
            </ShellButton>
            <ShellButton variant="outline" onClick={exportFullJpg}>
              <DashboardIcon name="table" className="h-[14px] w-[14px]" />
              JPG Completo
            </ShellButton>
            <ShellButton variant="gold" onClick={exportFullPdf}>
              <DashboardIcon name="pdf" className="h-[14px] w-[14px]" />
              PDF Completo
            </ShellButton>
          </>
        }
      />

      {toast ? (
        <AlertBox tone="info" className="mb-4 flex items-center gap-2">
          <DashboardIcon name="check" className="h-[14px] w-[14px]" />
          {toast}
        </AlertBox>
      ) : null}

      <div ref={reportRef} className="mb-4 rounded-[10px] border border-border bg-surface shadow-panel">
        <div className="flex flex-col justify-between gap-5 p-5 md:flex-row md:items-center">
          <div>
            <div className="font-mono text-[15px] font-bold text-navy-800">ARGUS COMISS</div>
            <div className="text-[12px] text-text-secondary">
              Relatório de Comissões - {MONTHS[selectedMonth]} {selectedYear}
            </div>
            <div className="mt-0.5 text-[11px] text-text-muted">
              Gerado em: {new Date().toLocaleDateString("pt-BR")} · Sistema de Gestão de Comissões
            </div>
          </div>
          <div className="text-left md:text-right">
            <div className="text-[12px] text-text-secondary">
              Total de unidades: <strong>{units.length}</strong>
            </div>
            <div className="text-[12px] text-text-secondary">
              Funcionários no relatório: <strong>{employees.length}</strong>
            </div>
            <div className="mt-1 text-[12px] font-bold text-gold-600">Comissão total: {formatCommissionCurrency(totalCommission)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {units.map((unit) => {
          const completion = getUnitPerformancePercent({
            goalAmount: unit.goal,
            resultAmount: unit.result,
            goalLiters: typeof unit.goalLiters === "number" ? unit.goalLiters : 0,
            resultLiters: typeof unit.resultLiters === "number" ? unit.resultLiters : 0,
            goalStock: typeof unit.goalStock === "number" ? unit.goalStock : 0,
            resultStock: typeof unit.resultStock === "number" ? unit.resultStock : 0,
          });
          const byCommission = (a: ReportsOverview["employees"][number], b: ReportsOverview["employees"][number]) =>
            getEmployeeRankingCommission(b) - getEmployeeRankingCommission(a);

          const unitEmployees = [...employees.filter((employee) => employee.unitId === unit.id)];
          const daytimeEmployees = unitEmployees.filter((e) => e.employeeShift !== "NIGHTTIME").sort(byCommission);
          const nighttimeEmployees = unitEmployees.filter((e) => e.employeeShift === "NIGHTTIME").sort(byCommission);
          const goalLiters = getReportUnitGoalLiters(unit.goalLiters, unitEmployees);
          const isExpanded = Boolean(expandedUnits[unit.id]);

          return (
            <section
              key={unit.id}
              ref={(node) => {
                unitReportRefs.current[unit.id] = node;
              }}
              className="overflow-hidden rounded-[10px] border border-border bg-surface shadow-panel"
            >
              <div className="flex flex-col gap-3 bg-navy-800 px-4 py-3 text-white lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <div className="text-[14px] font-bold">{unit.name}</div>
                  <div className="mt-0.5 text-[11px] text-white/65">
                    {unitEmployees.length} registros do período · {MONTHS[selectedMonth]}/{selectedYear}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={progressTone(completion.value)} className="text-[12px]">
                    {formatPercentPtBr(completion.value)}% da meta
                  </StatusBadge>
                  <ShellButton
                    size="sm"
                    className="border border-white/20 bg-white/10 text-white hover:bg-white/15"
                    onClick={() => exportUnitCsv(unit)}
                  >
                    <DashboardIcon name="table" className="h-[14px] w-[14px]" />
                    CSV
                  </ShellButton>
                  <ShellButton
                    size="sm"
                    className="border border-white/20 bg-white/10 text-white hover:bg-white/15"
                    onClick={() => exportUnitReportAsJpeg(unit)}
                  >
                    <DashboardIcon name="table" className="h-[14px] w-[14px]" />
                    JPG
                  </ShellButton>
                  <ShellButton
                    size="sm"
                    className="bg-gold-500 text-navy-950 hover:opacity-90"
                    onClick={() => exportUnitPdf(unit)}
                  >
                    <DashboardIcon name="pdf" className="h-[14px] w-[14px]" />
                    PDF
                  </ShellButton>
                  <ShellButton
                    size="sm"
                    className="border border-white/20 bg-white/10 text-white hover:bg-white/15"
                    onClick={() => toggleUnitExpand(unit.id)}
                  >
                    {isExpanded ? "Recolher" : "Expandir"}
                  </ShellButton>
                </div>
              </div>

              {isExpanded ? (
                <>
                  <div className="grid border-b border-border md:grid-cols-4">
                    {[
                      { label: "Meta Mensal", value: formatCurrency(unit.goal), tone: "text-text-primary" },
                      { label: "Resultado", value: formatCurrency(unit.result), tone: "text-text-primary" },
                      { label: "Meta (Litros)", value: typeof goalLiters === "number" ? formatRawNumber(goalLiters) : "—", tone: "text-text-primary" },
                      { label: "Comissão Total", value: formatCommissionCurrency(unit.totalCommission), tone: "text-gold-600" },
                    ].map((item) => (
                      <div key={item.label} className="border-r border-border px-4 py-3 text-center last:border-r-0">
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-[1px] text-text-muted">{item.label}</div>
                        <div className={`font-mono text-[14px] font-bold ${item.tone}`}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1700px] border-collapse">
                      <thead>
                        <tr>
                          {["Funcionário", "Abastecimento", "Litragem", "Premiação Lit.", "Zona", "Correção", "Venda de Estoque", "Premiação Est.", "Zona", "Correção", "Total", "Dobras", "Resultado Final"].map((title, index) => (
                            <th
                              key={index}
                              className="border-b border-border bg-surface-2 px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[1.2px] text-text-muted"
                            >
                              {title}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {unitEmployees.length === 0 ? (
                          <tr>
                            <td colSpan={13} className="px-3.5 py-3 text-center text-[12px] text-text-muted">
                              Nenhum registro mensal encontrado para esta unidade no período.
                            </td>
                          </tr>
                        ) : null}
                        {daytimeEmployees.map((employee) => (
                          <EmployeeRow key={employee.id} employee={employee} />
                        ))}
                        {nighttimeEmployees.length > 0 && (
                          <>
                            <tr>
                              <td colSpan={13} className="border-b border-t border-border bg-surface-2 px-3.5 py-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-[1.2px] text-text-muted">Turno Noturno</span>
                              </td>
                            </tr>
                            {nighttimeEmployees.map((employee) => (
                              <EmployeeRow key={employee.id} employee={employee} />
                            ))}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className="mt-2 border-t border-border px-1 py-5 text-center text-[11px] text-text-muted">
        Documento gerado automaticamente pelo sistema ARGUS COMISS · Rede Horizonte Combustíveis
      </div>
    </div>
  );
}

// notMet=true: meta definida mas não batida → exibe "NÃO BATEU" em vermelho; status justificado usa texto padrão.
// active=false: sem dado → exibe "—"
// multiplier <= 1.0: sem potencialização → texto simples
// multiplier > 1.0: quadrado colorido + label (Verde / Azul)
function ZoneCell({ multiplier, active = true, notMet = false, notMetLabel = "NÃO BATEU" }: { multiplier: number; active?: boolean; notMet?: boolean; notMetLabel?: string }) {
  if (notMet) {
    const isNotMetPerformance = notMetLabel === "NÃO BATEU";

    return (
      <span className={isNotMetPerformance ? "text-[12px] font-semibold text-danger" : "text-[12px] text-text-primary"}>
        {notMetLabel}
      </span>
    );
  }
  if (!active) return <span className="text-[12px] text-text-muted">—</span>;
  if (multiplier <= 1.0) return <span className="text-[12px] text-text-muted">Neutra (1.00)</span>;
  const isAzul = multiplier >= 1.25;
  const squareBg = isAzul ? "#1B3A6B" : "#16a34a";
  const label = isAzul ? `Azul (${multiplier.toFixed(2)})` : `Verde (${multiplier.toFixed(2)})`;
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-[2px]" style={{ backgroundColor: squareBg }} />
      <span className="text-[12px] font-medium text-text-primary">{label}</span>
    </div>
  );
}

function EmployeeRow({ employee }: { employee: ReportsOverview["employees"][number] }) {
  const total = employee.correctedLiters + employee.correctedStock;
  const finalResult = employee.finalTotalCommission ?? employee.totalCommission;
  const { metLitragem, metEstoque } = employee;
  const litragemHasGoal = employee.finalGoalLiters > 0;
  const noPeriodResult = !hasEmployeePeriodResult(employee);
  const notMetLabel = noPeriodResult ? getPeriodStatusLabel(employee.periodStatus) : "NÃO BATEU";

  return (
    <tr className="group">
      {/* 1. Funcionário → name + vínculo (Efetivado / Experiência) */}
      <td className="border-b border-border px-3.5 py-3 group-hover:bg-surface-2">
        <div className="flex items-center gap-2">
          <Avatar label={initials(employee.name)} className="h-6 w-6 text-[9px]" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] leading-tight">{employee.name}</span>
            <StatusBadge tone={vinculoTone(employee.experienceStatus)} className="w-fit text-[9px]">
              {vinculoLabel(employee.experienceStatus)}
            </StatusBadge>
            {!employee.commissionEligible ? <><StatusBadge tone="red" className="w-fit text-[9px]">Litragem não atingida</StatusBadge><span className="max-w-52 text-[10px] text-danger">Meta individual de litragem não atingida ({formatRawNumber(employee.completionPercent)}% / necessário {formatRawNumber(employee.minimumEligibilityPercentage)}%)</span></> : null}
          </div>
        </div>
      </td>
      {/* 2. Abastecimento */}
      <td className="border-b border-border px-3.5 py-3 text-right font-mono text-[12px] text-text-primary group-hover:bg-surface-2">
        {employee.abastecimento > 0 ? employee.abastecimento.toLocaleString("pt-BR") : "—"}
      </td>
      {/* 3. Litragem → soldLiters (sempre exibe o realizado) */}
      <td className="border-b border-border px-3.5 py-3 text-right font-mono text-[12px] text-text-primary group-hover:bg-surface-2">
        {employee.soldLiters.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
      </td>
      {/* 4. Premiação Litragem → baseCommission (traço se meta não batida) */}
      <td className="border-b border-border px-3.5 py-3 text-right font-mono text-[12px] text-text-primary group-hover:bg-surface-2">
        {metLitragem ? formatCommissionCurrency(employee.baseCommission) : formatCommissionCurrency(0)}
      </td>
      {/* 5. Zona (litragem) → NÃO BATEU se meta definida e não atingida */}
      <td className="border-b border-border px-3.5 py-3 group-hover:bg-surface-2">
        <ZoneCell multiplier={employee.litersMultiplier} notMet={!metLitragem && litragemHasGoal} notMetLabel={notMetLabel} />
      </td>
      {/* 6. Correção litragem → valor resolvido pelo cálculo oficial */}
      <td className="border-b border-border px-3.5 py-3 text-right font-mono text-[12px] font-semibold text-text-primary group-hover:bg-surface-2">
        {metLitragem ? formatCommissionCurrency(employee.correctedLiters) : formatCommissionCurrency(0)}
      </td>
      {/* 7. Venda de Estoque → soldStock (sempre exibe o realizado) */}
      <td className="border-b border-border px-3.5 py-3 text-right font-mono text-[12px] text-text-primary group-hover:bg-surface-2">
        {employee.soldStock > 0 ? formatCommissionCurrency(employee.soldStock) : "—"}
      </td>
      {/* 8. Premiação Estoque → stockCommission (traço se meta não batida) */}
      <td className="border-b border-border px-3.5 py-3 text-right font-mono text-[12px] text-text-primary group-hover:bg-surface-2">
        {employee.stockCommission > 0 && metEstoque ? formatCommissionCurrency(employee.stockCommission) : formatCommissionCurrency(0)}
      </td>
      {/* 9. Zona (estoque) → NÃO BATEU se meta definida e não atingida; "—" se sem dado */}
      <td className="border-b border-border px-3.5 py-3 group-hover:bg-surface-2">
        <ZoneCell multiplier={employee.stockMultiplier} active={employee.soldStock > 0} notMet={!metEstoque} notMetLabel={notMetLabel} />
      </td>
      {/* 10. Correção estoque → valor resolvido pelo cálculo oficial */}
      <td className="border-b border-border px-3.5 py-3 text-right font-mono text-[12px] font-semibold text-text-primary group-hover:bg-surface-2">
        {metEstoque && employee.correctedStock > 0 ? formatCommissionCurrency(employee.correctedStock) : formatCommissionCurrency(0)}
      </td>
      {/* 11. Total → componentes resolvidos, sem recalcular regras */}
      <td className="border-b border-border px-3.5 py-3 text-right font-mono text-[12px] font-semibold text-text-primary group-hover:bg-surface-2">
        {formatCommissionCurrency(total)}
      </td>
      {/* 12. Dobras → adicional informado na aba Metas */}
      <td className="border-b border-border px-3.5 py-3 text-right font-mono text-[12px] font-semibold text-text-primary group-hover:bg-surface-2">
        {!employee.commissionEligible ? formatCommissionCurrency(0) : employee.dobras > 0 ? formatCommissionCurrency(employee.dobras) : "—"}
      </td>
      {/* 13. Resultado Final → comissão normal + dobras */}
      <td className="border-b border-border px-3.5 py-3 text-right font-mono text-[12px] font-bold text-gold-600 group-hover:bg-surface-2">
        {formatCommissionCurrency(finalResult)}
      </td>
    </tr>
  );
}
