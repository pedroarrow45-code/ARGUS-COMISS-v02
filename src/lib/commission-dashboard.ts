import { MONTHS } from "@/data/commission-dashboard";
import type { Employee, Unit } from "@/types/commission-dashboard";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/\u00A0/g, " ");
}

export function formatCurrencyFixed2(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/\u00A0/g, " ");
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatRawNumber(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function percent(result: number, goal: number) {
  if (goal <= 0) {
    return "0.0";
  }

  return ((result / goal) * 100).toFixed(1);
}

export function getUnitPerformancePercent(params: {
  goalAmount: number;
  resultAmount: number;
  goalLiters: number;
  resultLiters: number;
  goalStock: number;
  resultStock: number;
}) {
  const { goalAmount, resultAmount, goalLiters, resultLiters, goalStock, resultStock } = params;

  if (goalAmount > 0 && resultAmount > 0) {
    return { value: percent(resultAmount, goalAmount), source: "Financeiro" as const };
  }

  const operational: number[] = [];
  if (goalLiters > 0 && resultLiters >= 0) operational.push((resultLiters / goalLiters) * 100);
  if (goalStock > 0 && resultStock >= 0) operational.push((resultStock / goalStock) * 100);

  if (operational.length === 0) {
    return { value: "0.0", source: null };
  }

  const average = operational.reduce((sum, current) => sum + current, 0) / operational.length;
  return { value: average.toFixed(1), source: "Operacional" as const };
}

export function formatPercentPtBr(value: string | number) {
  return String(value).replace(".", ",");
}

export function progressTone(percentValue: string | number) {
  const value = Number(percentValue);

  if (value >= 100) {
    return "green";
  }

  if (value >= 80) {
    return "gold";
  }

  return "red";
}

export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function calculateUnitCommission(unit: Unit) {
  const completion = unit.result / unit.goal;
  return completion >= 1 ? unit.result * 0.02 : unit.result * 0.01;
}

export function getActiveEmployeesForUnit(employees: Employee[], unitId: number | string) {
  return employees.filter(
    (employee) =>
      employee.unitId === unitId &&
      (typeof employee.completionPercent === "number" || employee.status === "ativo"),
  );
}

function getUnitCommissionValue(unit: Unit) {
  return typeof unit.totalCommission === "number" ? unit.totalCommission : 0;
}

function getEmployeeCommissionValue(employee: Employee) {
  if (typeof employee.rankingCommission === "number") {
    return employee.rankingCommission;
  }

  if (typeof employee.finalTotalCommission === "number") {
    return employee.finalTotalCommission;
  }

  return typeof employee.totalCommission === "number" ? employee.totalCommission : 0;
}

function getPeriodStatusLabel(status: Employee["periodStatus"]) {
  if (status === "VACATION") return "FÉRIAS";
  if (status === "ABSENCE") return "FALTA";
  if (status === "MEDICAL_LEAVE") return "ATESTADO";
  return "NÃO BATEU";
}

function hasEmployeePeriodResult(employee: Employee) {
  return (
    (typeof employee.soldLiters === "number" && employee.soldLiters > 0) ||
    (typeof employee.soldStock === "number" && employee.soldStock > 0) ||
    (typeof employee.rankingCommission === "number" && employee.rankingCommission > 0) ||
    (typeof employee.totalCommission === "number" && employee.totalCommission > 0) ||
    getCorrectedLitersValue(employee) > 0 ||
    getCorrectedStockValue(employee) > 0
  );
}

function getCorrectedLitersValue(employee: Employee) {
  return typeof employee.correctedLiters === "number" ? employee.correctedLiters : 0;
}

function getCorrectedStockValue(employee: Employee) {
  return typeof employee.correctedStock === "number" ? employee.correctedStock : 0;
}

function getValidLitersValue(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function sumLiters(values: Array<number | null>) {
  const validValues = values.filter((value): value is number => typeof value === "number");

  if (validValues.length === 0) {
    return null;
  }

  return validValues.reduce((sum, value) => sum + value, 0);
}

export function getReportUnitGoalLiters(unitGoalLiters: number | undefined, activeEmployees: Employee[]) {
  const manualValue = getValidLitersValue(unitGoalLiters);
  if (manualValue !== null) return manualValue;

  return sumLiters(
    activeEmployees.map((employee) => getValidLitersValue(employee.finalGoalLiters) ?? getValidLitersValue(employee.baseGoalLiters)),
  );
}

function unitZoneBadge(result: number, goal: number): string {
  if (goal <= 0 || result <= 0) return `<span style="color:#8A9BBB;font-size:10px">—</span>`;
  const pct = result / goal;
  if (pct >= 1.35) {
    return `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#1B3A6B;vertical-align:middle;margin-right:3px"></span><span style="color:#1B3A6B;font-size:10px;font-weight:700">Azul · ${(pct * 100).toFixed(1)}%</span>`;
  }
  if (pct >= 1.05) {
    return `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#16a34a;vertical-align:middle;margin-right:3px"></span><span style="color:#16a34a;font-size:10px;font-weight:700">Verde · ${(pct * 100).toFixed(1)}%</span>`;
  }
  if (pct >= 1.0) {
    return `<span style="color:#8A9BBB;font-size:10px">${(pct * 100).toFixed(1)}% (meta atingida)</span>`;
  }
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#dc2626;vertical-align:middle;margin-right:3px"></span><span style="color:#dc2626;font-size:10px;font-weight:700">Vermelho · ${(pct * 100).toFixed(1)}%</span>`;
}

// Override visual manual de metas no bloco "Regras de Comissão" do relatório.
// Afeta SOMENTE a exibição — não alimenta cálculo de comissão.
// Adicionar entrada apenas quando o valor armazenado no banco estiver incorreto para a exibição.
type ReportGoalOverride = { dayLitersGoal?: number; dayStockGoal?: number; nightLitersGoal?: number; nightStockGoal?: number };
function getManualReportGoalOverride(unitName: string): ReportGoalOverride {
  const name = unitName.toUpperCase().trim();
  if (name.includes("PONTAL SUL")) return { dayLitersGoal: 20000 };
  if (name.includes("GOIAS NORTE") || name.includes("GOIÁS NORTE")) return { dayStockGoal: 2300 };
  return {};
}

export function buildPrintHtml(units: Unit[], employees: Employee[], month: number, year: number, title: string) {
  const normalizedUnitName = units.length === 1
    ? units[0].name.replace(/^Horizonte\s*/i, "").trim()
    : "TODAS AS UNIDADES";
  const headerUnitName = normalizedUnitName.length > 0 ? normalizedUnitName : "UNIDADE";
  const reportPeriod = `${MONTHS[month]}/${year}`;
  const singleUnit = units.length === 1 ? units[0] : null;
  const singleUnitEmployees = singleUnit ? getActiveEmployeesForUnit(employees, singleUnit.id) : [];

  const permanentEmployees = singleUnitEmployees.filter((employee) => employee.employmentType === "PERMANENT" || employee.experienceStatus === "efetivado");
  const pickShiftBaseGoal = (shift: "DAYTIME" | "NIGHTTIME") => {
    const group = permanentEmployees.filter((employee) => (employee.employeeShift ?? "DAYTIME") === shift);
    const firstWithGoals = group.find((employee) => {
      const liters = getValidLitersValue(employee.finalGoalLiters) ?? getValidLitersValue(employee.baseGoalLiters);
      const stock = getValidLitersValue(employee.stockGoalCommission);
      return liters != null || stock != null;
    });
    const liters = firstWithGoals
      ? (getValidLitersValue(firstWithGoals.finalGoalLiters) ?? getValidLitersValue(firstWithGoals.baseGoalLiters))
      : null;
    const stock = firstWithGoals ? getValidLitersValue(firstWithGoals.stockGoalCommission) : null;
    return { count: group.length, liters, stock };
  };
  const override = singleUnit ? getManualReportGoalOverride(singleUnit.name) : {};
  const daytimeRaw = pickShiftBaseGoal("DAYTIME");
  const nighttimeRaw = pickShiftBaseGoal("NIGHTTIME");
  const daytimeBaseGoals = {
    ...daytimeRaw,
    liters: override.dayLitersGoal != null ? override.dayLitersGoal : daytimeRaw.liters,
    stock: override.dayStockGoal != null ? override.dayStockGoal : daytimeRaw.stock,
  };
  const nighttimeBaseGoals = {
    ...nighttimeRaw,
    liters: override.nightLitersGoal != null ? override.nightLitersGoal : nighttimeRaw.liters,
    stock: override.nightStockGoal != null ? override.nightStockGoal : nighttimeRaw.stock,
  };
  const employeeBaseGoalsHtml = [
    `<p><strong>1. Efetivados — Diurno (${daytimeBaseGoals.count})</strong><br/>Litragem: ${daytimeBaseGoals.liters != null ? `${formatRawNumber(daytimeBaseGoals.liters)} L` : "—"}<br/>Estoque: ${daytimeBaseGoals.stock != null ? formatCurrencyFixed2(daytimeBaseGoals.stock) : "—"}</p>`,
    `<p><strong>2. Efetivados — Noturno (${nighttimeBaseGoals.count})</strong><br/>Litragem: ${nighttimeBaseGoals.liters != null ? `${formatRawNumber(nighttimeBaseGoals.liters)} L` : "—"}<br/>Estoque: ${nighttimeBaseGoals.stock != null ? formatCurrencyFixed2(nighttimeBaseGoals.stock) : "—"}</p>`,
  ].join("");
  const rows = units
    .map((unit) => {
      const activeEmployees = getActiveEmployeesForUnit(employees, unit.id)
        .sort((a, b) => getEmployeeCommissionValue(b) - getEmployeeCommissionValue(a));
      const goalLiters = getReportUnitGoalLiters(unit.goalLiters, activeEmployees);
      const bonusMessage = activeEmployees.some((employee) => employee.bonusApplied)
        ? "Equipe atingiu meta — bônus +5% aplicado"
        : "";
      const performance = getUnitPerformancePercent({
        goalAmount: typeof unit.goal === "number" ? unit.goal : 0,
        resultAmount: typeof unit.result === "number" ? unit.result : 0,
        goalLiters: typeof goalLiters === "number" ? goalLiters : 0,
        resultLiters: typeof unit.resultLiters === "number" ? unit.resultLiters : 0,
        goalStock: typeof unit.goalStock === "number" ? unit.goalStock : 0,
        resultStock: typeof unit.resultStock === "number" ? unit.resultStock : 0,
      });

      const byCommission = (a: Employee, b: Employee) =>
        getEmployeeCommissionValue(b) - getEmployeeCommissionValue(a);
      const daytime = activeEmployees.filter((e) => e.employeeShift !== "NIGHTTIME").sort(byCommission);
      const nighttime = activeEmployees.filter((e) => e.employeeShift === "NIGHTTIME").sort(byCommission);

      const buildRow = (employee: Employee, rank: number): string => {
        // A exportação apenas apresenta o multiplicador resolvido pela consulta oficial.
        const noPeriodResult = !hasEmployeePeriodResult(employee);
        const notMetLabel = noPeriodResult ? getPeriodStatusLabel(employee.periodStatus) : "NÃO BATEU";
        const zoneHtml = (mult: number, active = true, notMet = false): string => {
          if (notMet) {
            return notMetLabel === "NÃO BATEU"
              ? `<span style="color:#dc2626;font-size:10px;font-weight:700">${notMetLabel}</span>`
              : `<span>${notMetLabel}</span>`;
          }
          if (!active) return `<span style="color:#8A9BBB">—</span>`;
          if (mult <= 1.0) {
            return '<span style="color:#8A9BBB;font-size:10px">Neutra (1.00)</span>';
          }
          const isAzul = mult >= 1.25;
          const color = isAzul ? "#1B3A6B" : "#16a34a";
          return `<span style="display:inline-block;width:12px;height:12px;background-color:${color};border-radius:2px;line-height:0;vertical-align:middle;-webkit-print-color-adjust:exact;print-color-adjust:exact"></span>`;
        };
        // Se metLitragem/metEstoque não estiver no objeto (uso legado), exibe tudo normalmente
        const metLitragem = employee.metLitragem !== false;
        const metEstoque = employee.metEstoque !== false;
        const litragemHasGoal = typeof employee.finalGoalLiters === "number" && employee.finalGoalLiters > 0;
        const lm = employee.litersMultiplier ?? 1;
        const lmLabel = zoneHtml(lm, true, !metLitragem && litragemHasGoal);
        const sm = employee.stockMultiplier ?? 1;
        const hasStock = typeof employee.soldStock === "number" && employee.soldStock > 0;
        const smLabel = zoneHtml(sm, hasStock, !metEstoque);
        const abastecimento = typeof employee.abastecimento === "number" && employee.abastecimento > 0
          ? employee.abastecimento.toLocaleString("pt-BR")
          : "—";
        const soldL = typeof employee.soldLiters === "number" ? formatRawNumber(employee.soldLiters) : "—";
        const premiacaoLit = metLitragem
          ? formatCurrencyFixed2(typeof employee.baseCommission === "number" ? employee.baseCommission : 0)
          : formatCurrencyFixed2(0);
        const correcaoLit = metLitragem ? formatCurrencyFixed2(getCorrectedLitersValue(employee)) : formatCurrencyFixed2(0);
        const vendaEst = typeof employee.soldStock === "number" && employee.soldStock > 0 ? formatCurrencyFixed2(employee.soldStock) : "—";
        const premiacaoEst = (typeof employee.stockCommission === "number" && employee.stockCommission > 0 && metEstoque)
          ? formatCurrencyFixed2(employee.stockCommission)
          : formatCurrencyFixed2(0);
        const corrEst = getCorrectedStockValue(employee);
        const correcaoEst = corrEst > 0 && metEstoque ? formatCurrencyFixed2(corrEst) : formatCurrencyFixed2(0);
        const total = formatCurrencyFixed2(getCorrectedLitersValue(employee) + corrEst);
        const dobras = typeof employee.dobras === "number" && employee.dobras > 0 ? formatCurrencyFixed2(employee.dobras) : "—";
        const finalResultValue = typeof employee.finalTotalCommission === "number"
          ? employee.finalTotalCommission
          : (typeof employee.totalCommission === "number" ? employee.totalCommission : 0);
        const resultadoFinal = formatCurrencyFixed2(finalResultValue);
        // Vínculo: PERMANENT → Efetivado (navy), PROBATION → Experiência (gold).
        const expStatus = employee.experienceStatus;
        const expBg = expStatus === "efetivado" ? "#1B3A6B" : "#92400e";
        const expText = expStatus === "efetivado" ? "Efetivado" : "Experiência";
        const expBadge = expStatus
          ? `<span style="display:inline-block;background:${expBg};color:#fff;border-radius:99px;padding:1px 5px;font-size:8px;font-weight:700;margin-top:2px">${expText}</span>`
          : "";
        const nameCell = `<div style="display:flex;flex-direction:column;gap:1px">${employee.name}${expBadge}</div>`;
        return `<tr><td class="tr">${rank}</td><td>${nameCell}</td><td class="tr">${abastecimento}</td><td class="tr">${soldL}</td><td class="tr">${premiacaoLit}</td><td class="tr">${lmLabel}</td><td class="tr">${correcaoLit}</td><td class="tr">${vendaEst}</td><td class="tr">${premiacaoEst}</td><td class="tr">${smLabel}</td><td class="tr">${correcaoEst}</td><td class="tr">${total}</td><td class="tr">${dobras}</td><td class="tr gold">${resultadoFinal}</td></tr>`;
      };

      const nighttimeSep = nighttime.length > 0
        ? `<tr><td colspan="14" style="background:#F5F7FB;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8A9BBB;padding:5px 12px;border-top:1px solid #DDE3EE;border-bottom:1px solid #DDE3EE">Turno Noturno</td></tr>`
        : "";

      const bodyRows =
        activeEmployees.length === 0
          ? '<tr><td colspan="14" class="empty">Nenhum funcionário ativo nesta unidade.</td></tr>'
          : [
              ...daytime.map((emp, i) => buildRow(emp, i + 1)),
              nighttimeSep,
              ...nighttime.map((emp, i) => buildRow(emp, i + 1)),
            ].join("");

      const unitGoalStock = typeof unit.goalStock === "number" ? unit.goalStock : 0;
      const unitResultLiters = typeof unit.resultLiters === "number" ? unit.resultLiters : 0;
      const unitResultStock = typeof unit.resultStock === "number" ? unit.resultStock : 0;
      const litZone = (unitResultLiters > 0 && typeof goalLiters === "number" && goalLiters > 0)
        ? `<div style="margin-top:3px">${unitZoneBadge(unitResultLiters, goalLiters)}</div>` : "";
      const estZone = (unitResultStock > 0 && unitGoalStock > 0)
        ? `<div style="margin-top:3px">${unitZoneBadge(unitResultStock, unitGoalStock)}</div>` : "";

      return `
        <div class="unit-block">
          <div class="unit-header">
            <div>
              <div class="unit-name">ARGUS COMISS · ${unit.name}</div>
              <div class="unit-sub">${MONTHS[month]} / ${year} · ${formatPercentPtBr(performance.value)}% (${performance.source ?? "Sem base"})</div>
            </div>
          </div>
          <div class="unit-stats">
            <div class="stat-box"><div class="sl">Meta Litragem</div><div class="sv">${typeof goalLiters === "number" && goalLiters > 0 ? formatRawNumber(goalLiters) : "—"}</div></div>
            <div class="stat-box"><div class="sl">Alcançado Litragem</div><div class="sv">${unitResultLiters > 0 ? formatRawNumber(unitResultLiters) : "—"}</div>${litZone}</div>
            <div class="stat-box"><div class="sl">Meta Estoque</div><div class="sv">${unitGoalStock > 0 ? formatCurrencyFixed2(unitGoalStock) : "—"}</div></div>
            <div class="stat-box"><div class="sl">Alcançado Estoque</div><div class="sv">${unitResultStock > 0 ? formatCurrencyFixed2(unitResultStock) : "—"}</div>${estZone}</div>
          </div>
          ${bonusMessage ? `<div class="bonus-banner">${bonusMessage}</div>` : ""}
          <table>
            <thead><tr><th class="tr">Rank</th><th>Funcionário</th><th class="tr">Abast.</th><th class="tr">Litragem</th><th class="tr">Prem. Lit.</th><th class="tr">Zona</th><th class="tr">Corr. Lit.</th><th class="tr">Venda Est.</th><th class="tr">Prem. Est.</th><th class="tr">Zona</th><th class="tr">Corr. Est.</th><th class="tr">Total</th><th class="tr">Dobras</th><th class="tr">Resultado Final</th></tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
    @page{size:landscape;margin:8mm}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:100%}
    body{font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:#0D1B30;background:#fff;padding:0}
    .report-page{max-width:281mm;margin:0 auto;padding:8mm 10mm}
    .header{border-bottom:3px solid #0B1829;padding-bottom:12px;margin-bottom:20px}
    .logo{font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:700;color:#0B1829;letter-spacing:0.5px}
    .logo-unit{color:#0B1829}
    .logo-sub{font-size:13px;color:#4A5E7A;margin-top:5px;font-weight:600}
    .unit-block{border:1px solid #DDE3EE;border-radius:8px;margin-bottom:16px;overflow:hidden}
    .unit-header{background:#102038;color:#fff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center}
    .unit-name{font-weight:700;font-size:13px}
    .unit-sub{font-size:10px;opacity:.6;margin-top:2px}
    .unit-pct{font-weight:700;font-size:12px;background:rgba(255,255,255,0.15);padding:3px 10px;border-radius:99px}
    .unit-stats{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #DDE3EE}
    .stat-box{padding:9px 14px;border-right:1px solid #DDE3EE;text-align:center}
    .stat-box:last-child{border-right:none}
    .sl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8A9BBB;margin-bottom:3px}
    .sv{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#0D1B30}
    .sv.gold{color:#B8860B}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    thead th{padding:7px 12px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8A9BBB;background:#F5F7FB;border-bottom:1px solid #DDE3EE;text-align:left}
    tbody td{padding:9px 12px;border-bottom:1px solid #DDE3EE;font-size:12px}
    th,td{vertical-align:middle}
    th:first-child,td:first-child{width:22%;word-break:break-word}
    tbody tr:last-child td{border-bottom:none}
    .tr{text-align:right}
    .gold{font-family:'IBM Plex Mono',monospace;font-weight:700;color:#B8860B}
    .badge{background:#E8F7EF;color:#1A9E5C;border-radius:99px;padding:2px 8px;font-size:10px;font-weight:700}
    .badge-green{background:#E8F7EF;color:#1A9E5C;border-radius:99px;padding:2px 8px;font-size:10px;font-weight:700}
    .badge-red{background:#FEE8E8;color:#D63E3E;border-radius:99px;padding:2px 8px;font-size:10px;font-weight:700}
    .badge-navy{background:#E8EDF5;color:#1D4170;border-radius:99px;padding:2px 8px;font-size:10px;font-weight:700}
    .bonus-banner{padding:6px 10px;background:#EEF9F1;color:#1A9E5C;font-weight:700;font-size:10px;border-bottom:1px solid #DDE3EE}
    .empty{text-align:center;color:#8A9BBB;padding:12px}
    .rules-block{margin-top:12px;border:1px solid #DDE3EE;border-radius:8px;background:#fff;padding:10px}
    .rules-block h3{margin:0 0 8px 0;font-size:12px;font-weight:700;color:#102038;letter-spacing:.6px;text-transform:uppercase}
    .rules-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .rule-card{border:1px solid #E4EAF3;border-radius:6px;background:#F8FAFE;padding:8px}
    .rule-title{font-size:10px;font-weight:700;color:#163050;margin-bottom:4px}
    .rule-card p{margin:2px 0;font-size:10px;line-height:1.35;color:#2D405D}
    .rules-footnote{margin-top:8px;padding-top:8px;border-top:1px solid #DDE3EE;font-size:10px;font-weight:700;color:#163050;text-align:center}
    .footer{text-align:center;margin-top:24px;font-size:10px;color:#8A9BBB;border-top:1px solid #DDE3EE;padding-top:12px}
    .footer strong{color:#102038}
    @media print{
      @page{size:landscape;margin:8mm}
      body{padding:0;font-size:10px}
      .report-page{max-width:none;padding:0}
      .header{margin-bottom:12px;padding-bottom:8px}
      .logo{font-size:16px}
      .unit-block{break-inside:auto;page-break-inside:auto;overflow:visible;margin-bottom:10px}
      .unit-header{padding:6px 10px}
      .unit-name{font-size:11px}
      .stat-box{padding:6px 8px}
      .sl{font-size:8px}
      .sv{font-size:11px}
      thead{display:table-header-group}
      tfoot{display:table-footer-group}
      thead th{padding:4px 6px;font-size:8px;letter-spacing:0.5px}
      tbody td{padding:5px 6px;font-size:10px}
      .rules-block{break-inside:avoid;page-break-inside:avoid}
    }
  </style></head><body>
  <div class="report-page">
  <div class="header">
    <div>
      <div class="logo">ARGUS COMISS · <span class="logo-unit">${headerUnitName}</span></div>
      <div class="logo-sub">${reportPeriod}</div>
    </div>
  </div>
  ${rows}
  <section class="rules-block">
    <h3>Regras de Comissão</h3>
    <div class="rules-grid">
      <div class="rule-card">
        <div class="rule-title">1) Regra de experiência</div>
        <p>Funcionário em experiência deve atingir <strong>70,0%</strong> da meta cheia.</p>
        <p>Exemplo: meta cheia 20.000 L → meta considerada 14.000 L.</p>
      </div>
      <div class="rule-card">
        <div class="rule-title">Metas dos funcionários no período</div>
        ${employeeBaseGoalsHtml}
      </div>
      <div class="rule-card">
        <div class="rule-title">2) Regra do bônus do time</div>
        <p>Quando a unidade bate a meta coletiva de litragem, aplica <strong>+5,0%</strong> sobre a comissão de litragem potencializada.</p>
      </div>
      <div class="rule-card">
        <div class="rule-title">Comissão de Litragem</div>
        <p><strong>Efetivados:</strong> R$ 0,01 por litro</p>
        <p><strong>Experiência:</strong> R$ 0,0075 por litro</p>
      </div>
      <div class="rule-card">
        <div class="rule-title">3) Zonas</div>
        <p><strong>Zona neutra:</strong> 100,0%</p>
        <p><strong>Zona verde:</strong> 115,0%</p>
        <p><strong>Zona azul:</strong> 125,0%</p>
        <p><strong>Meta não batida:</strong> NÃO BATEU / FÉRIAS / FALTA / ATESTADO</p>
      </div>
    </div>
    <div class="rules-footnote">Com a conquista total do time, a comissão aumenta em 5,0%.</div>
  </section>
  <div class="footer">Documento gerado automaticamente pelo ARGUS COMISS</div>
  </div>
  <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`;
}

export function buildCsv(units: Unit[], employees: Employee[], month: number, year: number) {
  const separator = ";";
  const now = new Date().toLocaleDateString("pt-BR");

  const lines = [
    "ARGUS COMISS - Relatório de Comissões",
    `Período${separator}${MONTHS[month]}/${year}`,
    `Gerado em${separator}${now}`,
    "",
    `Unidade${separator}Meta${separator}Resultado${separator}Meta (L)${separator}% Meta${separator}Comissão Total${separator}Funcionário${separator}Abastecimento${separator}Litragem${separator}Premiação Lit.${separator}Zona${separator}Correção Lit.${separator}Venda de Estoque${separator}Premiação Est.${separator}Zona${separator}Correção Est.${separator}Total${separator}Dobras${separator}Resultado Final`,
  ];

  units.forEach((unit) => {
    const activeEmployees = getActiveEmployeesForUnit(employees, unit.id)
      .sort((a, b) => getEmployeeCommissionValue(b) - getEmployeeCommissionValue(a));
    const commission = getUnitCommissionValue(unit);
    const performance = getUnitPerformancePercent({
      goalAmount: unit.goal,
      resultAmount: unit.result,
      goalLiters: typeof unit.goalLiters === "number" ? unit.goalLiters : 0,
      resultLiters: typeof unit.resultLiters === "number" ? unit.resultLiters : 0,
      goalStock: typeof unit.goalStock === "number" ? unit.goalStock : 0,
      resultStock: typeof unit.resultStock === "number" ? unit.resultStock : 0,
    });

    const goalL = typeof unit.goalLiters === "number" ? formatRawNumber(unit.goalLiters) : "—";

    if (activeEmployees.length === 0) {
      lines.push(
        `${unit.name}${separator}${formatRawNumber(unit.goal)}${separator}${formatRawNumber(unit.result)}${separator}${goalL}${separator}${formatPercentPtBr(performance.value)}%${separator}${formatRawNumber(commission)}${separator}—${separator}—${separator}—${separator}—${separator}—${separator}—${separator}—${separator}—${separator}—${separator}—${separator}—${separator}—${separator}—`,
      );
    } else {
      activeEmployees.forEach((employee, index) => {
        const noPeriodResultCsv = !hasEmployeePeriodResult(employee);
        const notMetCsvLabel = noPeriodResultCsv ? getPeriodStatusLabel(employee.periodStatus) : "NÃO BATEU";
        const csvZoneLabel = (multiplier: number, active = true, notMet = false) => {
          if (notMet) return notMetCsvLabel;
          if (!active) return "—";
          return multiplier >= 1.25 ? `Azul (${multiplier.toFixed(2)})` : multiplier > 1.0 ? `Verde (${multiplier.toFixed(2)})` : "Neutra (1.00)";
        };
        const metLitragemCsv = employee.metLitragem !== false;
        const metEstoqueCsv = employee.metEstoque !== false;
        const litragemHasGoalCsv = typeof employee.finalGoalLiters === "number" && employee.finalGoalLiters > 0;
        const lm = employee.litersMultiplier ?? 1;
        const lmLabel = csvZoneLabel(lm, true, !metLitragemCsv && litragemHasGoalCsv);
        const sm = employee.stockMultiplier ?? 1;
        const hasStockCsv = typeof employee.soldStock === "number" && employee.soldStock > 0;
        const smLabel = csvZoneLabel(sm, hasStockCsv, !metEstoqueCsv);
        const empSoldL = typeof employee.soldLiters === "number" ? formatRawNumber(employee.soldLiters) : "—";
        const abastecimento = typeof employee.abastecimento === "number" && employee.abastecimento > 0
          ? employee.abastecimento.toLocaleString("pt-BR")
          : "—";
        const premiacaoLit = typeof employee.baseCommission === "number" ? formatRawNumber(employee.baseCommission) : "—";
        const correcaoLit = formatRawNumber(getCorrectedLitersValue(employee));
        const vendaEst = typeof employee.soldStock === "number" && employee.soldStock > 0 ? formatRawNumber(employee.soldStock) : "—";
        const premiacaoEst = typeof employee.stockCommission === "number" && employee.stockCommission > 0 ? formatRawNumber(employee.stockCommission) : "—";
        const corrEst = getCorrectedStockValue(employee);
        const correcaoEst = corrEst > 0 ? formatRawNumber(corrEst) : "—";
        const totalVal = formatRawNumber(getCorrectedLitersValue(employee) + corrEst);
        const dobras = typeof employee.dobras === "number" && employee.dobras > 0 ? formatRawNumber(employee.dobras) : "—";
        const resultadoFinal = typeof employee.finalTotalCommission === "number"
          ? formatRawNumber(employee.finalTotalCommission)
          : (typeof employee.totalCommission === "number" ? formatRawNumber(employee.totalCommission) : "—");
        const prefix = index === 0
          ? `${unit.name}${separator}${formatRawNumber(unit.goal)}${separator}${formatRawNumber(unit.result)}${separator}${goalL}${separator}${formatPercentPtBr(performance.value)}%${separator}${formatRawNumber(commission)}`
          : `${separator}${separator}${separator}${separator}${separator}`;
        lines.push(`${prefix}${separator}${employee.name}${separator}${abastecimento}${separator}${empSoldL}${separator}${premiacaoLit}${separator}${lmLabel}${separator}${correcaoLit}${separator}${vendaEst}${separator}${premiacaoEst}${separator}${smLabel}${separator}${correcaoEst}${separator}${totalVal}${separator}${dobras}${separator}${resultadoFinal}`);
      });
    }

    lines.push("");
  });

  lines.push(
    `Comissão Total Rede${separator}${separator}${separator}${separator}${separator}${separator}${separator}${separator}${separator}${separator}${separator}${separator}${separator}${separator}${separator}${separator}${separator}${separator}${formatRawNumber(
      units.reduce((sum, unit) => sum + getUnitCommissionValue(unit), 0),
    )}`,
  );
  lines.push("", "Powered by ARGUS SYSTEMS");

  return `\uFEFF${lines.join("\r\n")}`;
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function openPrintWindow(html: string) {
  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
}
