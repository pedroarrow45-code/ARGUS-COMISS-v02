import { PrismaClient } from "@prisma/client";

import { auditCommissionRecord } from "../src/features/commission-dashboard/engine/audit-commission-record";
import type { CommissionZone } from "../src/features/commission-dashboard/engine/calculate-commission";
import type { EmployeeShift, EmploymentType } from "../src/features/commission-dashboard/engine/types";
import { getCommissionRulesById, getCommissionRulesForPeriod } from "../src/features/commission-dashboard/rules/get-commission-rules";

type AuditClassification = ReturnType<typeof auditCommissionRecord>["classification"];

type AuditRow = {
  unidade: string;
  statusMes: "FECHADO" | "ABERTO";
  rulesetEsperado: string;
  rulesetFechamento: string | null;
  funcionario: string;
  tipo: EmploymentType;
  turno: EmployeeShift;
  metaBaseL: number;
  metaEfetivaL: number;
  vendidoL: number;
  atingimentoEsperado: number;
  atingimentoSnapshot: number;
  zonaEsperada: CommissionZone;
  multiplicadorPersistido: number;
  metaBaseEstoque: number;
  metaEfetivaEstoque: number;
  estoqueVendido: number;
  fatorLitros80: number;
  fatorEstoque80: number;
  finalEsperado: number;
  finalPersistido: number;
  delta: number;
  status: AuditClassification | "PREVIEW" | "RULESET_DIVERGENTE";
};

const prisma = new PrismaClient();
const year = Number(process.argv[2] ?? 2026);
const month = Number(process.argv[3] ?? 8);
if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new Error("Uso: tsx scripts/audit-commission-period.ts [ano] [mês]");

const number = (value: { toNumber(): number } | number | null | undefined) => value == null ? 0 : typeof value === "number" ? value : value.toNumber();

async function main() {
  const units = await prisma.unit.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true,
      monthlyMetrics: { where: { year, month }, take: 1, select: { goalLiters: true, closedAt: true, commissionRuleSetId: true } },
      employeeMonthlyRecords: {
        where: { year, month }, orderBy: { employee: { name: "asc" } },
        include: { employee: { select: { name: true } } },
      },
    },
  });
  const periodRules = await getCommissionRulesForPeriod({ year, month }, prisma);
  const rows: AuditRow[] = [];
  for (const unit of units) {
    const metric = unit.monthlyMetrics[0];
    const closed = metric?.closedAt != null;
    const rules = closed && metric?.commissionRuleSetId ? await getCommissionRulesById(metric.commissionRuleSetId, prisma) : periodRules;
    const rulesetMismatch = closed && metric?.commissionRuleSetId !== periodRules.id;
    const unitSoldLiters = unit.employeeMonthlyRecords.reduce((sum, record) => sum + number(record.soldLiters), 0);
    const unitMetLitersGoal = number(metric?.goalLiters) > 0 && unitSoldLiters >= number(metric?.goalLiters);
    for (const record of unit.employeeMonthlyRecords) {
      const audit = auditCommissionRecord({
        employeeId: record.employeeId, employeeName: record.employee.name,
        employmentType: record.employmentType, employeeShift: record.employeeShift,
        baseGoalLiters: number(record.baseGoalLiters), finalGoalLiters: number(record.finalGoalLiters), soldLiters: number(record.soldLiters),
        stockGoalCommission: number(record.stockGoalCommission), baseStockGoal: number(record.baseStockGoal),
        effectiveStockGoal: number(record.effectiveStockGoal), soldStock: number(record.soldStock), stockCommission: number(record.stockCommission),
        dobras: number(record.dobras), litersMultiplier: number(record.litersMultiplier), stockMultiplier: number(record.stockMultiplier),
        bonusAmount: number(record.bonusAmount), totalCommission: number(record.totalCommission), finalTotalCommission: number(record.finalTotalCommission),
      }, rules.rules, unitMetLitersGoal);
      rows.push({
        unidade: unit.name, statusMes: closed ? "FECHADO" : "ABERTO", rulesetEsperado: periodRules.id,
        rulesetFechamento: metric?.commissionRuleSetId ?? null, funcionario: record.employee.name,
        tipo: record.employmentType, turno: record.employeeShift,
        metaBaseL: audit.historical.baseGoalLiters, metaEfetivaL: audit.expected.effectiveGoalLiters, vendidoL: number(record.soldLiters),
        atingimentoEsperado: audit.expected.achievementPercentage, atingimentoSnapshot: audit.historical.achievementPercentage,
        zonaEsperada: audit.expected.litersZone, multiplicadorPersistido: number(record.litersMultiplier),
        metaBaseEstoque: audit.historical.baseStockGoal, metaEfetivaEstoque: audit.expected.effectiveStockGoal,
        estoqueVendido: number(record.soldStock), fatorLitros80: audit.expected.litersFactor, fatorEstoque80: audit.expected.stockFactor,
        finalEsperado: audit.expected.finalTotalCommission, finalPersistido: number(record.finalTotalCommission), delta: audit.delta,
        status: !closed ? "PREVIEW" : rulesetMismatch ? "RULESET_DIVERGENTE" : audit.classification,
      });
    }
  }
  const summary = units.map((unit) => {
    const unitRows = rows.filter((row) => row.unidade === unit.name);
    return {
      unidade: unit.name,
      funcionarios: unitRows.length,
      permanent: unitRows.filter((row) => row.tipo === "PERMANENT").length,
      probation: unitRows.filter((row) => row.tipo === "PROBATION").length,
      daytime: unitRows.filter((row) => row.turno === "DAYTIME").length,
      nighttime: unitRows.filter((row) => row.turno === "NIGHTTIME").length,
      divergentes: unitRows.filter((row) => row.status !== "OK" && row.status !== "PREVIEW").length,
      impactoFinanceiro: unitRows.reduce((sum, row) => sum + row.delta, 0),
    };
  });
  console.table(summary);
  console.log(JSON.stringify({ period: { year, month }, summary, rows }, null, 2));
}

main().finally(() => prisma.$disconnect());
