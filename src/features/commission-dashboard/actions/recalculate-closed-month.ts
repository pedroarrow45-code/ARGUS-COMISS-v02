"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { calculateCommission } from "../engine/calculate-commission";
import { getCommissionRulesById } from "../rules/get-commission-rules";
import type { ActionResult } from "../types/action-result";

type Input = { unitId: string; year: number; month: number; actor: string; reason: string };
type DecimalLike = { toNumber(): number };
const number = (value: DecimalLike | number | null | undefined) => value == null ? 0 : typeof value === "number" ? value : value.toNumber();
const derived = (record: any) => ({
  employeeId: record.employeeId, baseRate: record.baseRate, baseCommission: record.baseCommission,
  litersMultiplier: record.litersMultiplier, stockMultiplier: record.stockMultiplier,
  bonusApplied: record.bonusApplied, bonusAmount: record.bonusAmount, totalCommission: record.totalCommission,
  finalTotalCommission: record.finalTotalCommission, commissionEligible: record.commissionEligible,
  minimumEligibilityPercentage: record.minimumEligibilityPercentage, ineligibilityReason: record.ineligibilityReason,
});

/** Explicit, single-unit historical correction. Never mutates operational inputs. */
export async function recalculateClosedMonth(input: Input): Promise<ActionResult> {
  if (!input.unitId?.trim() || !input.actor?.trim() || !input.reason?.trim()) return { success: false, error: "Unidade, responsável e motivo são obrigatórios." };
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100 || !Number.isInteger(input.month) || input.month < 1 || input.month > 12) return { success: false, error: "Competência inválida." };
  try {
    await prisma.$transaction(async (tx) => {
      const metric = await tx.unitMonthlyMetric.findUnique({
        where: { unitId_year_month: { unitId: input.unitId, year: input.year, month: input.month } },
        select: { closedAt: true, goalLiters: true, commissionRuleSetId: true },
      });
      if (!metric?.closedAt) throw new Error("A operação exige um fechamento já encerrado.");
      if (!metric.commissionRuleSetId) throw new Error("O fechamento não possui regra versionada vinculada.");
      const rules = await getCommissionRulesById(metric.commissionRuleSetId, tx);
      const records = await tx.employeeMonthlyRecord.findMany({ where: { unitId: input.unitId, year: input.year, month: input.month } });
      if (!records.length) throw new Error("Nenhum registro encontrado para a competência.");
      const unitMetLitersGoal = number(metric.goalLiters) > 0 && records.reduce((sum, row) => sum + number(row.soldLiters), 0) >= number(metric.goalLiters);
      const previousResults = records.map(derived);
      const newResults = [];
      for (const record of records) {
        const result = calculateCommission({
          employmentType: record.employmentType, employeeShift: record.employeeShift,
          baseGoalLiters: number(record.baseGoalLiters), soldLiters: number(record.soldLiters), unitMetLitersGoal,
          soldStock: record.soldStock == null ? null : number(record.soldStock),
          stockGoal: record.baseStockGoal == null
            ? record.stockGoalCommission == null ? null : number(record.stockGoalCommission)
            : number(record.baseStockGoal),
          stockBaseCommission: number(record.stockCommission), dobras: number(record.dobras),
        }, rules.rules);
        const data = {
          baseRate: result.baseRate, baseCommission: result.baseCommission, litersMultiplier: result.litersMultiplier,
          stockMultiplier: result.stockMultiplier, bonusApplied: result.bonusApplied, bonusAmount: result.bonusAmount,
          totalCommission: result.totalCommission, finalTotalCommission: result.finalTotalCommission,
          commissionEligible: result.eligible, minimumEligibilityPercentage: result.minimumEligibilityPercentage,
          ineligibilityReason: result.ineligibilityReason,
        };
        await tx.employeeMonthlyRecord.update({ where: { id: record.id }, data });
        newResults.push({ employeeId: record.employeeId, ...data });
      }
      await tx.commissionRecalculationAudit.create({ data: {
        unitId: input.unitId, year: input.year, month: input.month, commissionRuleSetId: rules.id,
        actor: input.actor.trim(), reason: input.reason.trim(),
        previousResults: previousResults as Prisma.InputJsonValue, newResults: newResults as Prisma.InputJsonValue,
      } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Falha ao recalcular fechamento." };
  }
  revalidatePath("/", "layout");
  return { success: true };
}
