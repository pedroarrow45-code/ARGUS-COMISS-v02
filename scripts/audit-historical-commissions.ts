import { createHash } from "node:crypto";

import { PrismaClient } from "@prisma/client";

import { calculateCommission, roundCommission, type CommissionRules } from "../src/features/commission-dashboard/engine/calculate-commission";

type DecimalLike = { toNumber(): number };
type Status = "MATCH" | "MISMATCH_DERIVED_FIELDS" | "MISSING_RULESET" | "MISSING_SOURCE_DATA" | "INVALID_SOURCE_DATA" | "UNSAFE_TO_RECALCULATE";

const prisma = new PrismaClient();
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, "").split("=");
  return [key, value.join("=")];
}));

function number(value: DecimalLike | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber();
}

function rulesFromRow(row: any): CommissionRules {
  return {
    rates: {
      DAYTIME: { PERMANENT: number(row.daytimePermanentRate)!, PROBATION: number(row.daytimeProbationRate)! },
      NIGHTTIME: { PERMANENT: number(row.nighttimePermanentRate)!, PROBATION: number(row.nighttimeProbationRate)! },
    },
    probationGoalFactor: number(row.probationGoalFactor)!,
    minimumEligibilityPercentage: number(row.minimumEligibilityPercentage)!,
    teamBonusRate: number(row.teamBonusRate)!,
    zones: {
      neutralMultiplier: number(row.neutralMultiplier)!, greenMinimumPercentage: number(row.greenMinimumPercentage)!,
      greenMultiplier: number(row.greenMultiplier)!, blueMinimumPercentage: number(row.blueMinimumPercentage)!,
      blueMultiplier: number(row.blueMultiplier)!,
    },
  };
}

const immutableProjection = (record: any) => ({
  id: record.id, employeeId: record.employeeId, unitId: record.unitId, year: record.year, month: record.month,
  baseGoalLiters: number(record.baseGoalLiters), baseStockGoal: number(record.baseStockGoal),
  stockGoalCommission: number(record.stockGoalCommission), soldLiters: number(record.soldLiters),
  soldStock: number(record.soldStock), stockCommission: number(record.stockCommission), dobras: number(record.dobras),
  employmentType: record.employmentType, employeeShift: record.employeeShift, periodStatus: record.periodStatus,
  goalSource: record.goalSource,
});

function fingerprint(records: any[], metrics: any[]) {
  const facts = {
    records: records.map(immutableProjection),
    metrics: metrics.map((metric) => ({
      id: metric.id, unitId: metric.unitId, year: metric.year, month: metric.month,
      goalLiters: number(metric.goalLiters), closedAt: metric.closedAt?.toISOString() ?? null,
      commissionRuleSetId: metric.commissionRuleSetId,
    })),
  };
  return createHash("sha256").update(JSON.stringify(facts)).digest("hex");
}

function same(expected: unknown, persisted: unknown) {
  if (typeof expected === "number") return typeof persisted === "number" && Math.abs(expected - persisted) < 0.005;
  return expected === persisted;
}

function periodFilter() {
  const parse = (raw: string | undefined) => raw && /^(\d{4})-(\d{2})$/.test(raw)
    ? { year: Number(raw.slice(0, 4)), month: Number(raw.slice(5)) } : null;
  const from = parse(args.from); const to = parse(args.to);
  const clauses: any[] = [];
  if (from) clauses.push({ OR: [{ year: { gt: from.year } }, { year: from.year, month: { gte: from.month } }] });
  if (to) clauses.push({ OR: [{ year: { lt: to.year } }, { year: to.year, month: { lte: to.month } }] });
  return clauses.length ? { AND: clauses } : {};
}

async function main() {
  if (process.argv.includes("--apply")) throw new Error("Este auditor é estritamente read-only e não aceita --apply.");

  const report = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const readOnly = await tx.$queryRawUnsafe<Array<{ transaction_read_only: string }>>("SHOW transaction_read_only");
    if (readOnly[0]?.transaction_read_only !== "on") throw new Error("O banco não confirmou a transação read-only.");

    const metricWhere = { closedAt: { not: null }, ...periodFilter() };
    const metrics = await tx.unitMonthlyMetric.findMany({
      where: metricWhere, orderBy: [{ year: "asc" }, { month: "asc" }, { unit: { name: "asc" } }],
      include: { unit: { select: { name: true } } },
    });
    const metricKeys = metrics.map((m) => ({ unitId: m.unitId, year: m.year, month: m.month }));
    const records = metricKeys.length ? await tx.employeeMonthlyRecord.findMany({
      where: { OR: metricKeys }, orderBy: [{ year: "asc" }, { month: "asc" }, { unit: { name: "asc" } }, { employee: { name: "asc" } }],
      include: { employee: { select: { name: true } }, unit: { select: { name: true } } },
    }) : [];
    const ruleIds = [...new Set(metrics.flatMap((m) => m.commissionRuleSetId ? [m.commissionRuleSetId] : []))];
    const ruleRows = await tx.commissionRuleSet.findMany({ where: { id: { in: ruleIds } } });
    const rulesById = new Map(ruleRows.map((row) => [row.id, row]));
    const metricsByKey = new Map(metrics.map((m) => [`${m.unitId}:${m.year}:${m.month}`, m]));
    const unitTotals = new Map<string, number>();
    for (const record of records) {
      const key = `${record.unitId}:${record.year}:${record.month}`;
      unitTotals.set(key, (unitTotals.get(key) ?? 0) + (number(record.soldLiters) ?? 0));
    }
    const before = fingerprint(records, metrics);

    const rows = records.map((record) => {
      const key = `${record.unitId}:${record.year}:${record.month}`;
      const metric = metricsByKey.get(key)!;
      const ruleRow = metric.commissionRuleSetId ? rulesById.get(metric.commissionRuleSetId) : null;
      const source = immutableProjection(record);
      const missing: string[] = [];
      const invalid: string[] = [];
      if (source.baseGoalLiters == null || source.baseGoalLiters === 0) missing.push("baseGoalLiters");
      if (source.soldLiters == null) missing.push("soldLiters");
      if ((source.soldStock ?? 0) > 0 && source.stockCommission == null) missing.push("stockCommission");
      if (((source.soldStock ?? 0) > 0 || (source.stockCommission ?? 0) > 0)
        && (source.baseStockGoal ?? source.stockGoalCommission ?? 0) <= 0) missing.push("baseStockGoal");
      for (const [field, value] of Object.entries(source)) {
        if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) invalid.push(field);
      }

      let status: Status; let reason: string; let expected: any = null; let differences: string[] = [];
      if (!metric.commissionRuleSetId || !ruleRow) {
        status = "MISSING_RULESET"; reason = "Fechamento sem versão de regra recuperável.";
      } else if (missing.length) {
        status = "MISSING_SOURCE_DATA"; reason = `Dados-fonte ausentes: ${missing.join(", ")}.`;
      } else if (invalid.length) {
        status = "INVALID_SOURCE_DATA"; reason = `Dados-fonte inválidos: ${invalid.join(", ")}.`;
      } else {
        const rules = rulesFromRow(ruleRow);
        expected = calculateCommission({
          employmentType: record.employmentType, employeeShift: record.employeeShift,
          baseGoalLiters: source.baseGoalLiters!, soldLiters: source.soldLiters!,
          unitMetLitersGoal: (number(metric.goalLiters) ?? 0) > 0 && (unitTotals.get(key) ?? 0) >= (number(metric.goalLiters) ?? 0),
          soldStock: source.soldStock, stockGoal: source.baseStockGoal ?? source.stockGoalCommission,
          stockBaseCommission: source.stockCommission ?? 0, dobras: source.dobras ?? 0,
        }, rules);
        const persisted: Record<string, unknown> = {
          baseRate: number(record.baseRate), commissionEligible: record.commissionEligible,
          minimumEligibilityPercentage: number(record.minimumEligibilityPercentage), ineligibilityReason: record.ineligibilityReason,
          baseCommission: number(record.baseCommission), finalGoalLiters: number(record.finalGoalLiters),
          effectiveStockGoal: number(record.effectiveStockGoal), litersMultiplier: number(record.litersMultiplier),
          stockMultiplier: number(record.stockMultiplier), bonusApplied: record.bonusApplied,
          bonusAmount: number(record.bonusAmount), totalCommission: number(record.totalCommission),
          finalTotalCommission: number(record.finalTotalCommission),
        };
        const expectedDerived: Record<string, unknown> = {
          baseRate: expected.baseRate, commissionEligible: expected.eligible,
          minimumEligibilityPercentage: expected.minimumEligibilityPercentage, ineligibilityReason: expected.ineligibilityReason,
          baseCommission: expected.baseCommission, finalGoalLiters: expected.effectiveGoalLiters,
          effectiveStockGoal: expected.effectiveStockGoal || null, litersMultiplier: expected.litersMultiplier,
          stockMultiplier: expected.stockMultiplier, bonusApplied: expected.bonusApplied,
          bonusAmount: expected.bonusAmount, totalCommission: expected.totalCommission,
          finalTotalCommission: expected.finalTotalCommission,
        };
        differences = Object.keys(expectedDerived).filter((field) => !same(expectedDerived[field], persisted[field]));
        status = differences.length ? "MISMATCH_DERIVED_FIELDS" : "MATCH";
        const persistedFinal = number(record.finalTotalCommission) ?? 0;
        const onlyStock = !expected.litersCommissionEligible && expected.stockCommissionEligible;
        const bothZero = expected.hitLitersTarget && expected.hitStockTarget && (number(record.totalCommission) ?? 0) === 0 && persistedFinal === 0;
        const simpleBaseSum = record.employmentType === "PROBATION" && expected.litersMultiplier > 1
          && Math.abs(persistedFinal - roundCommission(expected.baseCommission + (source.stockCommission ?? 0) + (source.dobras ?? 0))) < 0.005;
        reason = status === "MATCH" ? "Todos os campos derivados conferem."
          : bothZero ? "CASO_A: ambas as metas atingidas, mas comissão de litros e resultado final persistidos como zero."
            : onlyStock && persistedFinal === 0 ? "CASO_B: somente estoque elegível, mas resultado final persistido como zero."
              : simpleBaseSum ? "CASO_C: Experiência persistida como soma de bases, sem potencialização esperada."
                : `Campos derivados divergentes: ${differences.join(", ")}.`;
      }

      return {
        month: `${record.year}-${String(record.month).padStart(2, "0")}`, unit: record.unit.name,
        employeeId: record.employeeId, employeeName: record.employee.name,
        employmentType: record.employmentType, employeeShift: record.employeeShift,
        commissionRuleSetId: metric.commissionRuleSetId, baseGoalLiters: source.baseGoalLiters,
        effectiveGoalLitersCalculated: expected?.effectiveGoalLiters ?? null, soldLiters: source.soldLiters,
        litersAchievement: expected?.achievementPercentage ?? null, baseStockGoal: source.baseStockGoal,
        effectiveStockGoalCalculated: expected?.effectiveStockGoal ?? null, soldStock: source.soldStock,
        stockAchievement: expected ? roundCommission(expected.stockAchievement * 100) : null,
        litersMultiplierPersisted: number(record.litersMultiplier), litersMultiplierExpected: expected?.litersMultiplier ?? null,
        stockMultiplierPersisted: number(record.stockMultiplier), stockMultiplierExpected: expected?.stockMultiplier ?? null,
        baseCommissionPersisted: number(record.baseCommission), baseCommissionExpected: expected?.baseCommission ?? null,
        bonusAmountPersisted: number(record.bonusAmount), bonusAmountExpected: expected?.bonusAmount ?? null,
        totalCommissionPersisted: number(record.totalCommission), totalCommissionExpected: expected?.totalCommission ?? null,
        finalTotalCommissionPersisted: number(record.finalTotalCommission), finalTotalCommissionExpected: expected?.finalTotalCommission ?? null,
        difference: expected ? roundCommission(expected.finalTotalCommission - (number(record.finalTotalCommission) ?? 0)) : null,
        status, reason, divergentFields: differences,
      };
    });

    const recordsAfter = metricKeys.length ? await tx.employeeMonthlyRecord.findMany({ where: { OR: metricKeys }, orderBy: [{ year: "asc" }, { month: "asc" }, { unitId: "asc" }, { id: "asc" }] }) : [];
    const metricsAfter = await tx.unitMonthlyMetric.findMany({ where: metricWhere, orderBy: [{ year: "asc" }, { month: "asc" }, { unitId: "asc" }] });
    // Normalize both snapshots because the reporting queries use presentation ordering.
    const normalize = (items: any[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
    const after = fingerprint(normalize(recordsAfter), normalize(metricsAfter));
    const normalizedBefore = fingerprint(normalize(records), normalize(metrics));
    if (normalizedBefore !== after) throw new Error("Invariante violada: dados-fonte mudaram durante a auditoria.");

    const counts = Object.fromEntries((["MATCH", "MISMATCH_DERIVED_FIELDS", "MISSING_RULESET", "MISSING_SOURCE_DATA", "INVALID_SOURCE_DATA", "UNSAFE_TO_RECALCULATE"] as Status[])
      .map((status) => [status, rows.filter((row) => row.status === status).length]));
    return {
      mode: "DRY_RUN_READ_ONLY", databaseReadOnlyConfirmed: true,
      filters: { from: args.from ?? null, to: args.to ?? null },
      safety: {
        immutableFields: ["baseGoalLiters", "baseStockGoal", "stockGoalCommission", "soldLiters", "soldStock", "stockCommission", "dobras", "employmentType", "employeeShift", "periodStatus", "goalSource", "closedAt", "commissionRuleSetId", "employeeId", "unitId", "year", "month"],
        beforeFingerprint: before, normalizedBeforeFingerprint: normalizedBefore, afterFingerprint: after, unchanged: true,
      },
      ruleSets: ruleRows.map((row) => ({ id: row.id, version: row.version, status: row.status, validFrom: row.validFrom.toISOString(), validUntil: row.validUntil?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })),
      summary: { totalSnapshots: rows.length, matches: counts.MATCH, mismatches: counts.MISMATCH_DERIVED_FIELDS, missingRuleSet: counts.MISSING_RULESET, missingSourceData: counts.MISSING_SOURCE_DATA, invalidSourceData: counts.INVALID_SOURCE_DATA, unsafeToRecalculate: counts.UNSAFE_TO_RECALCULATE },
      byMonth: [...new Set(rows.map((row) => row.month))].map((month) => ({ month, total: rows.filter((r) => r.month === month).length, mismatches: rows.filter((r) => r.month === month && r.status === "MISMATCH_DERIVED_FIELDS").length })),
      rows,
    };
  }, { isolationLevel: "RepeatableRead", timeout: 120_000 });

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
