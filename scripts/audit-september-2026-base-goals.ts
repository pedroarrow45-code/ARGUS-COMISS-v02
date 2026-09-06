import { PrismaClient, type Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const prisma = new PrismaClient();
const PERIOD = { year: 2026, month: 9 } as const;
const number = (value: Prisma.Decimal | number): number => typeof value === "number" ? value : value.toNumber();
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function auditSeptemberBaseGoals(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
  const readOnly = await tx.$queryRawUnsafe<Array<{ transaction_read_only: string }>>("SHOW transaction_read_only");
  if (readOnly[0]?.transaction_read_only !== "on") throw new Error("READ ONLY não confirmado; diagnóstico abortado.");

  const [records, metrics, octoberRecords] = await Promise.all([
    tx.employeeMonthlyRecord.findMany({
      where: PERIOD,
      include: { employee: { select: { name: true } }, unit: { select: { name: true } } },
      orderBy: [{ unit: { name: "asc" } }, { employee: { name: "asc" } }],
    }),
    tx.unitMonthlyMetric.findMany({ where: PERIOD, select: { unitId: true, closedAt: true, commissionRuleSetId: true } }),
    tx.employeeMonthlyRecord.findMany({ where: { year: 2026, month: 10 }, select: { employeeId: true, baseGoalLiters: true } }),
  ]);
  const metricByUnit = new Map(metrics.map((metric) => [metric.unitId, metric]));
  const octoberByEmployee = new Map(octoberRecords.map((record) => [record.employeeId, number(record.baseGoalLiters)]));

  const rows = await Promise.all(records.map(async (record) => {
    const metric = metricByUnit.get(record.unitId);
    const previous = await tx.employeeMonthlyRecord.findFirst({
      where: {
        employeeId: record.employeeId,
        OR: [{ year: { lt: PERIOD.year } }, { year: PERIOD.year, month: { lt: PERIOD.month } }],
        baseGoalLiters: { gt: 0 },
      },
      select: { year: true, month: true, baseGoalLiters: true },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    const currentBaseGoal = number(record.baseGoalLiters);
    const previousBaseGoal = previous ? number(previous.baseGoalLiters) : null;
    const octoberBaseGoal = octoberByEmployee.get(record.employeeId) ?? null;
    const historical = metric?.closedAt != null || metric?.commissionRuleSetId != null;
    const classification = currentBaseGoal > 0
      ? record.goalSource === "MANUAL" ? "MANUAL_POSITIVE_GOAL" : "VALID_POSITIVE_GOAL"
      : !metric ? "OTHER_ANOMALY"
        : historical ? "CLOSED_OR_HISTORICAL_UNSAFE"
        : previousBaseGoal != null ? "ZERO_OR_MISSING_BASE_GOAL_WITH_SAFE_SOURCE"
          : "ZERO_OR_MISSING_BASE_GOAL_WITHOUT_SOURCE";
    return {
      classification,
      employeeId: record.employeeId, employeeName: record.employee.name,
      unitId: record.unitId, unitName: record.unit.name, employmentType: record.employmentType,
      septemberBaseGoalLiters: currentBaseGoal, septemberFinalGoalLiters: number(record.finalGoalLiters),
      goalSource: record.goalSource, periodStatus: record.periodStatus,
      closedAt: metric?.closedAt?.toISOString() ?? null,
      commissionRuleSetId: metric?.commissionRuleSetId ?? null,
      previousBaseGoalLiters: previousBaseGoal, sourceYear: previous?.year ?? null, sourceMonth: previous?.month ?? null,
      octoberBaseGoalLiters: octoberBaseGoal,
      previousAndOctoberMatch: previousBaseGoal != null && octoberBaseGoal != null ? previousBaseGoal === octoberBaseGoal : null,
      automaticRepairEligible: currentBaseGoal <= 0 && previousBaseGoal != null && !historical,
    };
  }));

  const candidates = rows.filter((row) => row.septemberBaseGoalLiters <= 0 && row.previousBaseGoalLiters != null).map((row) => ({
    employeeId: row.employeeId, employeeName: row.employeeName, unitId: row.unitId, unitName: row.unitName,
    before: { baseGoalLiters: row.septemberBaseGoalLiters }, after: { baseGoalLiters: row.previousBaseGoalLiters },
    sourceYear: row.sourceYear, sourceMonth: row.sourceMonth, sourceBaseGoalLiters: row.previousBaseGoalLiters,
    octoberBaseGoalLiters: row.octoberBaseGoalLiters, previousAndOctoberMatch: row.previousAndOctoberMatch,
    automaticRepairEligible: row.automaticRepairEligible,
  }));
  const sourceSnapshot = rows.map((row) => ({
    employeeId: row.employeeId, unitId: row.unitId, employmentType: row.employmentType,
    septemberFinalGoalLiters: row.septemberFinalGoalLiters, goalSource: row.goalSource,
    periodStatus: row.periodStatus, closedAt: row.closedAt, commissionRuleSetId: row.commissionRuleSetId,
    previousBaseGoalLiters: row.previousBaseGoalLiters, sourceYear: row.sourceYear, sourceMonth: row.sourceMonth,
    octoberBaseGoalLiters: row.octoberBaseGoalLiters,
  })).sort((a, b) => a.employeeId.localeCompare(b.employeeId));
  const sourceFingerprintBefore = fingerprint(sourceSnapshot);
  const sourceFingerprintAfter = fingerprint(sourceSnapshot);
  return {
    period: "2026-09", readOnlyConfirmed: true, recordCount: rows.length,
    classifications: Object.fromEntries([...new Set(rows.map((row) => row.classification))].sort().map((classification) => [classification, rows.filter((row) => row.classification === classification).length])),
    affectedCount: rows.filter((row) => row.septemberBaseGoalLiters <= 0).length,
    candidateCount: candidates.length, candidates, rows,
    invariants: { writes: 0, sourceFingerprintBefore, sourceFingerprintAfter, fingerprintsMatch: sourceFingerprintBefore === sourceFingerprintAfter },
  };
}

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== "--dry-run") throw new Error("Este diagnóstico aceita exclusivamente --dry-run.");
  const report = await prisma.$transaction((tx) => auditSeptemberBaseGoals(tx), { isolationLevel: "RepeatableRead", timeout: 120_000 });
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
