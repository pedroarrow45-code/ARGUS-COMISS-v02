import { PrismaClient } from "@prisma/client";

import { getZoneFromPercentage, type CommissionZone } from "../src/features/commission-dashboard/engine/calculate-commission";
import type { EmployeeShift, EmploymentType } from "../src/features/commission-dashboard/engine/types";
import { getCommissionRulesById, getCommissionRulesForPeriod } from "../src/features/commission-dashboard/rules/get-commission-rules";

type DecimalLike = { toNumber(): number };
type RawGoalClassification =
  | "RAW_BASE_AND_EFFECTIVE_PRESENT"
  | "RAW_BASE_LOST_EFFECTIVE_SURVIVED"
  | "RAW_EFFECTIVE_LOST_BASE_SURVIVED"
  | "RAW_BOTH_LOST"
  | "RAW_EFFECTIVE_MISMATCH";

type RawAuditRow = {
  unitId: string;
  unitName: string;
  monthStatus: "OPEN" | "CLOSED" | "NO_METRIC";
  commissionRuleSetId: string | null;
  recordId: string;
  employeeId: string;
  employeeName: string;
  employmentType: EmploymentType;
  employeeShift: EmployeeShift;
  RAW_baseGoalLiters: number;
  RAW_finalGoalLiters: number;
  RAW_soldLiters: number;
  RAW_abastecimento: number;
  RAW_stockGoalCommission: number | null;
  RAW_baseStockGoal: number | null;
  RAW_effectiveStockGoal: number | null;
  RAW_soldStock: number | null;
  RAW_stockCommission: number | null;
  RAW_dobras: number | null;
  RAW_litersMultiplier: number | null;
  RAW_stockMultiplier: number | null;
  RAW_baseRate: number | null;
  RAW_baseCommission: number | null;
  RAW_bonusAmount: number | null;
  RAW_totalCommission: number | null;
  RAW_finalTotalCommission: number | null;
  goalSource: string;
  periodStatus: string;
  createdAt: string;
  updatedAt: string;
  EXPECTED: {
    effectiveGoalLiters: number;
    achievementPercentage: number;
    zone: CommissionZone;
    multiplier: number;
    effectiveStockGoal: number;
    stockAchievementPercentage: number;
    stockZone: CommissionZone;
    stockMultiplier: number;
  };
  RAW_CLASSIFICATION: {
    liters: RawGoalClassification;
    stock: RawGoalClassification;
  };
};

const prisma = new PrismaClient();
const year = Number(process.argv[2] ?? 2026);
const month = Number(process.argv[3] ?? 8);

if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
  throw new Error("Uso: tsx scripts/audit-commission-raw-period.ts [ano] [mês]");
}

function decimal(value: DecimalLike | number): number;
function decimal(value: DecimalLike | number | null | undefined): number | null;
function decimal(value: DecimalLike | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber();
}

function classifyRawGoal(base: number | null, effective: number | null, expected: number, tolerance: number): RawGoalClassification {
  const hasBase = base != null && base > 0;
  const hasEffective = effective != null && effective > 0;
  if (!hasBase && hasEffective) return "RAW_BASE_LOST_EFFECTIVE_SURVIVED";
  if (hasBase && !hasEffective) return "RAW_EFFECTIVE_LOST_BASE_SURVIVED";
  if (!hasBase && !hasEffective) return "RAW_BOTH_LOST";
  if (Math.abs(effective! - expected) > tolerance) return "RAW_EFFECTIVE_MISMATCH";
  return "RAW_BASE_AND_EFFECTIVE_PRESENT";
}

function collectGoalPaths(value: unknown, prefix = ""): string[] {
  if (value == null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const own = /(goal|meta|effective)/i.test(key) ? [path] : [];
    return [...own, ...collectGoalPaths(nested, path)];
  });
}

async function main() {
  const [metrics, records, recalculationAudits, periodRules] = await Promise.all([
    prisma.unitMonthlyMetric.findMany({
      where: { year, month },
      select: { unitId: true, closedAt: true, commissionRuleSetId: true },
    }),
    prisma.employeeMonthlyRecord.findMany({
      where: { year, month },
      orderBy: [{ unit: { name: "asc" } }, { employee: { name: "asc" } }],
      select: {
        id: true, employeeId: true, unitId: true, employmentType: true, employeeShift: true,
        baseGoalLiters: true, finalGoalLiters: true, soldLiters: true, abastecimento: true,
        stockGoalCommission: true, baseStockGoal: true, effectiveStockGoal: true,
        soldStock: true, stockCommission: true, dobras: true, litersMultiplier: true,
        stockMultiplier: true, baseRate: true, baseCommission: true, bonusAmount: true,
        totalCommission: true, finalTotalCommission: true, goalSource: true, periodStatus: true,
        createdAt: true, updatedAt: true,
        unit: { select: { name: true } }, employee: { select: { name: true } },
      },
    }),
    prisma.commissionRecalculationAudit.findMany({
      where: { year, month },
      orderBy: [{ unit: { name: "asc" } }, { createdAt: "asc" }],
      select: {
        unitId: true, year: true, month: true, createdAt: true, actor: true, reason: true,
        previousResults: true, newResults: true, unit: { select: { name: true } },
      },
    }),
    getCommissionRulesForPeriod({ year, month }, prisma),
  ]);

  const metricsByUnit = new Map(metrics.map((metric) => [metric.unitId, metric]));
  const rulesById = new Map([[periodRules.id, periodRules]]);
  for (const metric of metrics) {
    if (metric.commissionRuleSetId && !rulesById.has(metric.commissionRuleSetId)) {
      rulesById.set(metric.commissionRuleSetId, await getCommissionRulesById(metric.commissionRuleSetId, prisma));
    }
  }

  const rows: RawAuditRow[] = records.map((record) => {
    const metric = metricsByUnit.get(record.unitId);
    const resolvedRules = metric?.commissionRuleSetId ? rulesById.get(metric.commissionRuleSetId)! : periodRules;
    const factor = record.employmentType === "PROBATION" ? resolvedRules.rules.probationGoalFactor : 1;
    const rawBaseLiters = decimal(record.baseGoalLiters);
    const rawFinalLiters = decimal(record.finalGoalLiters);
    const rawBaseStock = decimal(record.baseStockGoal);
    const rawEffectiveStock = decimal(record.effectiveStockGoal);
    const rawSoldLiters = decimal(record.soldLiters);
    const rawSoldStock = decimal(record.soldStock);
    const expectedEffectiveGoal = Math.round(rawBaseLiters * factor * 1000) / 1000;
    const expectedEffectiveStockGoal = Math.round((rawBaseStock ?? 0) * factor * 100) / 100;
    const expectedAchievement = expectedEffectiveGoal > 0 ? rawSoldLiters / expectedEffectiveGoal * 100 : 0;
    const expectedStockAchievement = expectedEffectiveStockGoal > 0 ? (rawSoldStock ?? 0) / expectedEffectiveStockGoal * 100 : 0;
    const litersResolution = getZoneFromPercentage(expectedAchievement, resolvedRules.rules);
    const stockResolution = getZoneFromPercentage(expectedStockAchievement, resolvedRules.rules);

    return {
      unitId: record.unitId, unitName: record.unit.name,
      monthStatus: !metric ? "NO_METRIC" : metric.closedAt ? "CLOSED" : "OPEN",
      commissionRuleSetId: metric?.commissionRuleSetId ?? null,
      recordId: record.id, employeeId: record.employeeId, employeeName: record.employee.name,
      employmentType: record.employmentType, employeeShift: record.employeeShift,
      RAW_baseGoalLiters: rawBaseLiters, RAW_finalGoalLiters: rawFinalLiters,
      RAW_soldLiters: rawSoldLiters, RAW_abastecimento: record.abastecimento,
      RAW_stockGoalCommission: decimal(record.stockGoalCommission), RAW_baseStockGoal: rawBaseStock,
      RAW_effectiveStockGoal: rawEffectiveStock, RAW_soldStock: rawSoldStock,
      RAW_stockCommission: decimal(record.stockCommission), RAW_dobras: decimal(record.dobras),
      RAW_litersMultiplier: decimal(record.litersMultiplier), RAW_stockMultiplier: decimal(record.stockMultiplier),
      RAW_baseRate: decimal(record.baseRate), RAW_baseCommission: decimal(record.baseCommission),
      RAW_bonusAmount: decimal(record.bonusAmount), RAW_totalCommission: decimal(record.totalCommission),
      RAW_finalTotalCommission: decimal(record.finalTotalCommission),
      goalSource: record.goalSource, periodStatus: record.periodStatus,
      createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
      EXPECTED: {
        effectiveGoalLiters: expectedEffectiveGoal, achievementPercentage: expectedAchievement,
        zone: litersResolution.zone, multiplier: litersResolution.multiplier,
        effectiveStockGoal: expectedEffectiveStockGoal, stockAchievementPercentage: expectedStockAchievement,
        stockZone: stockResolution.zone, stockMultiplier: stockResolution.multiplier,
      },
      RAW_CLASSIFICATION: {
        liters: classifyRawGoal(rawBaseLiters, rawFinalLiters, expectedEffectiveGoal, 0.001),
        stock: classifyRawGoal(rawBaseStock, rawEffectiveStock, expectedEffectiveStockGoal, 0.01),
      },
    };
  });

  const summary = [...new Set(rows.map((row) => row.unitName))].map((unitName) => {
    const unitRows = rows.filter((row) => row.unitName === unitName);
    const count = (classification: RawGoalClassification, target: "liters" | "stock") =>
      unitRows.filter((row) => row.RAW_CLASSIFICATION[target] === classification).length;
    return {
      unitName, totalRecords: unitRows.length,
      rawBaseLostEffectiveSurvived: count("RAW_BASE_LOST_EFFECTIVE_SURVIVED", "liters"),
      rawEffectiveLostBaseSurvived: count("RAW_EFFECTIVE_LOST_BASE_SURVIVED", "liters"),
      rawBothLost: count("RAW_BOTH_LOST", "liters"),
      rawEffectiveMismatch: count("RAW_EFFECTIVE_MISMATCH", "liters"),
      rawConsistent: count("RAW_BASE_AND_EFFECTIVE_PRESENT", "liters"),
      stockBaseLost: count("RAW_BASE_LOST_EFFECTIVE_SURVIVED", "stock"),
      stockBothLost: count("RAW_BOTH_LOST", "stock"),
      stockMismatch: count("RAW_EFFECTIVE_MISMATCH", "stock"),
    };
  });

  const auditTable = recalculationAudits.map((audit) => ({
    unitId: audit.unitId, unitName: audit.unit.name, year: audit.year, month: audit.month,
    createdAt: audit.createdAt.toISOString(), actor: audit.actor, reason: audit.reason,
    previousResults: audit.previousResults, newResults: audit.newResults,
    previousResultGoalPaths: collectGoalPaths(audit.previousResults),
    newResultGoalPaths: collectGoalPaths(audit.newResults),
  }));

  console.log(JSON.stringify({ period: { year, month }, summary, RAW: rows, recalculationAudits: auditTable }, null, 2));
}

main().finally(() => prisma.$disconnect());
