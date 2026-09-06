import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const damaged = await prisma.employeeMonthlyRecord.findMany({
  where: { baseGoalLiters: { lte: 0 } },
  include: { employee: { select: { name: true } }, unit: { select: { name: true } } },
  orderBy: [{ employeeId: "asc" }, { year: "asc" }, { month: "asc" }],
});

console.log(apply ? "MODE=APPLY" : "MODE=DRY_RUN (default; no writes)");
for (const record of damaged) {
  const source = await prisma.employeeMonthlyRecord.findFirst({
    where: {
      employeeId: record.employeeId,
      baseGoalLiters: { gt: 0 },
      OR: [{ year: { lt: record.year } }, { year: record.year, month: { lt: record.month } }],
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { year: true, month: true, baseGoalLiters: true, baseStockGoal: true },
  });
  const metric = await prisma.unitMonthlyMetric.findUnique({
    where: { unitId_year_month: { unitId: record.unitId, year: record.year, month: record.month } },
    select: { closedAt: true, commissionRuleSet: { select: { probationGoalFactor: true } } },
  });
  const factor = record.employmentType === "PROBATION"
    ? Number(metric?.commissionRuleSet?.probationGoalFactor ?? 0)
    : 1;
  const proposed = source ? Number(source.baseGoalLiters) : null;
  const expectedEffective = proposed != null && factor > 0
    ? Math.round(proposed * factor * 1000) / 1000
    : null;
  const recoverability = source ? "EXACT_FROM_PREVIOUS_BASE"
    : Number(record.finalGoalLiters) > 0 ? "NEEDS_HISTORICAL_RESTORE" : "NO_SOURCE";
  console.table({
    UNIT: record.unit.name, EMPLOYEE: record.employee.name,
    DAMAGED_PERIOD: `${record.year}-${String(record.month).padStart(2, "0")}`,
    CURRENT_BASE: Number(record.baseGoalLiters), CURRENT_EFFECTIVE: Number(record.finalGoalLiters),
    SOURCE_PERIOD: source ? `${source.year}-${String(source.month).padStart(2, "0")}` : null,
    SOURCE_BASE_GOAL: proposed, PROPOSED_BASE_GOAL: proposed, RECOVERABILITY: recoverability,
    CURRENT_finalGoalLiters: Number(record.finalGoalLiters), EXPECTED_finalGoalLiters: expectedEffective,
    CURRENT_effectiveStockGoal: record.effectiveStockGoal == null ? null : Number(record.effectiveStockGoal),
    EXPECTED_effectiveStockGoal: source?.baseStockGoal == null || factor <= 0
      ? null : Math.round(Number(source.baseStockGoal) * factor * 100) / 100,
  });
  if (apply && source) {
    // Primeiro reparo altera somente inputs/snapshots de meta; nunca resultados financeiros.
    await prisma.employeeMonthlyRecord.update({
      where: { id: record.id },
      data: {
        baseGoalLiters: source.baseGoalLiters,
        ...(metric?.closedAt && expectedEffective != null ? { finalGoalLiters: expectedEffective } : {}),
        ...(source.baseStockGoal != null ? { baseStockGoal: source.baseStockGoal } : {}),
      },
    });
  }
}

await prisma.$disconnect();
