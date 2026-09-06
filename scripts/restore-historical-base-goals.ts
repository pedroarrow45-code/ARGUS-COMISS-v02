import { PrismaClient } from "@prisma/client";
import { writeFile } from "node:fs/promises";

import { historicalSource, isPositive, restoreAction } from "./restore-historical-base-goals-core";

const YEAR = 2026;
const MONTHS = [3, 4, 5, 6, 7, 8] as const;
const CONFIRMATION = "RESTORE_HISTORICAL_BASE_GOALS";

const decimal = (value: { toString(): string } | null | undefined) => value == null ? null : value.toString();

async function main() {
  const currentUrl = process.env.DATABASE_URL?.trim();
  const historicalUrl = process.env.HISTORICAL_DATABASE_URL?.trim();
  if (!currentUrl || !historicalUrl) throw new Error("DATABASE_URL e HISTORICAL_DATABASE_URL são obrigatórias.");
  if (currentUrl === historicalUrl) throw new Error("ABORTADO: CURRENT e HISTORICAL apontam para o mesmo banco.");

  const applyRequested = process.argv.includes("--apply");
  const confirmed = process.argv.includes(`--confirm=${CONFIRMATION}`);
  const apply = applyRequested && confirmed;
  if (applyRequested && !confirmed) throw new Error(`ABORTADO: --apply exige --confirm=${CONFIRMATION}.`);

  const current = new PrismaClient({ datasourceUrl: currentUrl });
  const historical = new PrismaClient({ datasourceUrl: historicalUrl });
  try {
    const where = { year: YEAR, month: { in: [...MONTHS] } };
    const [historicalRecords, currentRecords] = await Promise.all([
      historical.employeeMonthlyRecord.findMany({
        where,
        select: {
          id: true, employeeId: true, unitId: true, year: true, month: true,
          employmentType: true, baseGoalLiters: true, finalGoalLiters: true,
          unit: { select: { name: true } }, employee: { select: { name: true } },
        },
        orderBy: [{ year: "asc" }, { month: "asc" }, { unitId: "asc" }, { employeeId: "asc" }],
      }),
      current.employeeMonthlyRecord.findMany({
        where,
        select: {
          id: true, employeeId: true, unitId: true, year: true, month: true,
          baseGoalLiters: true, finalGoalLiters: true, soldLiters: true, abastecimento: true,
          baseStockGoal: true, effectiveStockGoal: true, soldStock: true, stockCommission: true,
          dobras: true, baseRate: true, baseCommission: true, litersMultiplier: true,
          stockMultiplier: true, bonusAmount: true, totalCommission: true,
          finalTotalCommission: true, employmentType: true, employeeShift: true, goalSource: true,
        },
      }),
    ]);

    const currentById = new Map(currentRecords.map((record) => [record.id, record]));
    const plan = historicalRecords.map((historicalRecord) => {
      const currentRecord = currentById.get(historicalRecord.id);
      const source = historicalSource(historicalRecord);
      const classification = restoreAction(currentRecord, historicalRecord);
      console.log(JSON.stringify({
        UNIT: historicalRecord.unit.name, EMPLOYEE: historicalRecord.employee.name,
        YEAR: historicalRecord.year, MONTH: historicalRecord.month,
        EMPLOYMENT_TYPE: historicalRecord.employmentType,
        CURRENT_BASE: decimal(currentRecord?.baseGoalLiters),
        HISTORICAL_BASE: decimal(historicalRecord.baseGoalLiters),
        HISTORICAL_FINAL: decimal(historicalRecord.finalGoalLiters),
        SOURCE_BASE: decimal(source), ACTION: classification,
      }));
      return {
        recordId: historicalRecord.id, employeeId: historicalRecord.employeeId,
        unitId: historicalRecord.unitId, year: historicalRecord.year, month: historicalRecord.month,
        unit: historicalRecord.unit.name, employee: historicalRecord.employee.name,
        currentBaseGoalLiters: decimal(currentRecord?.baseGoalLiters),
        historicalBaseGoalLiters: decimal(historicalRecord.baseGoalLiters),
        historicalFinalGoalLiters: decimal(historicalRecord.finalGoalLiters),
        proposedBaseGoalLiters: decimal(source), classification,
      };
    });
    const candidates = plan.filter((item) => item.classification === "RESTORE");
    const candidateIds = new Set(candidates.map((item) => item.recordId));
    const backup = currentRecords.filter((record) => candidateIds.has(record.id)).map((record) => ({
      ...record,
      baseGoalLiters: decimal(record.baseGoalLiters), finalGoalLiters: decimal(record.finalGoalLiters),
      soldLiters: decimal(record.soldLiters), baseStockGoal: decimal(record.baseStockGoal),
      effectiveStockGoal: decimal(record.effectiveStockGoal), soldStock: decimal(record.soldStock),
      stockCommission: decimal(record.stockCommission), dobras: decimal(record.dobras),
      baseRate: decimal(record.baseRate), baseCommission: decimal(record.baseCommission),
      litersMultiplier: decimal(record.litersMultiplier), stockMultiplier: decimal(record.stockMultiplier),
      bonusAmount: decimal(record.bonusAmount), totalCommission: decimal(record.totalCommission),
      finalTotalCommission: decimal(record.finalTotalCommission),
    }));

    // Estes artefatos são concluídos antes do primeiro update, inclusive no dry-run.
    await writeFile("restore-plan.json", JSON.stringify(plan, null, 2));
    await writeFile("backup-before-goal-restore.json", JSON.stringify(backup, null, 2));
    const results: Array<{ recordId: string; status: "RESTORED" | "SKIPPED" | "FAILED"; reason?: string }> = [];
    if (apply) {
      for (const item of candidates) {
        try {
          const latest = await current.employeeMonthlyRecord.findUnique({
            where: { id: item.recordId },
            select: { id: true, employeeId: true, unitId: true, year: true, month: true, baseGoalLiters: true },
          });
          if (!latest
            || latest.id !== item.recordId
            || latest.employeeId !== item.employeeId
            || latest.unitId !== item.unitId
            || latest.year !== item.year
            || latest.month !== item.month) {
            results.push({ recordId: item.recordId, status: "SKIPPED", reason: "RECORD_MISMATCH" });
            continue;
          }
          if (isPositive(latest.baseGoalLiters)) {
            results.push({ recordId: item.recordId, status: "SKIPPED", reason: "SKIP_CONCURRENT_CHANGE" });
            continue;
          }
          await current.employeeMonthlyRecord.update({
            where: { id: item.recordId },
            data: { baseGoalLiters: item.proposedBaseGoalLiters! },
          });
          const verified = await current.employeeMonthlyRecord.findUnique({
            where: { id: item.recordId }, select: { baseGoalLiters: true },
          });
          if (!verified || verified.baseGoalLiters.toString() !== item.proposedBaseGoalLiters) {
            results.push({ recordId: item.recordId, status: "FAILED", reason: "POST_UPDATE_VALIDATION" });
          } else results.push({ recordId: item.recordId, status: "RESTORED" });
        } catch (error) {
          results.push({ recordId: item.recordId, status: "FAILED", reason: error instanceof Error ? error.message : "UNKNOWN" });
        }
      }
    } else {
      for (const item of candidates) results.push({ recordId: item.recordId, status: "SKIPPED", reason: "DRY_RUN" });
    }
    await writeFile("restore-result.json", JSON.stringify(results, null, 2));
    console.log(apply ? "MODE=APPLY" : "MODE=DRY_RUN; DATABASE WRITES=0");
  } finally {
    await Promise.all([current.$disconnect(), historical.$disconnect()]);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha desconhecida na restauração.");
  process.exitCode = 1;
});
