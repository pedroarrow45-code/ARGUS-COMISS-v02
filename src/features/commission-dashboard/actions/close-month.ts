"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

import { calculateCommission } from "../engine/calculate-commission";
import { getCommissionRulesById, getCommissionRulesForPeriod } from "../rules/get-commission-rules";
import type { ActionResult } from "../types/action-result";

type DecimalLike = { toNumber(): number };

function toNum(value: DecimalLike | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return value.toNumber();
}

type CloseMonthInput = {
  unitId: string;
  year: number;
  month: number;
};

export async function closeMonth(input: CloseMonthInput): Promise<ActionResult> {
  if (!input.unitId?.trim()) {
    return { success: false, error: "ID da unidade é obrigatório." };
  }

  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    return { success: false, error: "Ano inválido." };
  }

  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    return { success: false, error: "Mês inválido." };
  }

  const metric = await prisma.unitMonthlyMetric.findUnique({
    where: { unitId_year_month: { unitId: input.unitId, year: input.year, month: input.month } },
    select: { id: true, goalLiters: true, closedAt: true, commissionRuleSetId: true },
  });

  if (!metric) {
    return { success: false, error: "Meta mensal da unidade não encontrada." };
  }

  if (metric.closedAt) {
    return { success: false, error: "Este período já foi fechado." };
  }

  const records = await prisma.employeeMonthlyRecord.findMany({
    where: { unitId: input.unitId, year: input.year, month: input.month },
    select: {
      id: true,
      employeeId: true,
      employmentType: true,
      employeeShift: true,
      baseGoalLiters: true,
      finalGoalLiters: true,
      soldLiters: true,
      soldStock: true,
      stockCommission: true,
      stockGoalCommission: true,
      baseStockGoal: true,
      effectiveStockGoal: true,
      dobras: true,
      employee: { select: { status: true, unitId: true } },
    },
  });

  const operationalRecords = records.filter(
    (record) => record.employee.status === "ACTIVE" && record.employee.unitId === input.unitId,
  );

  if (operationalRecords.length === 0) {
    return { success: false, error: "Nenhum registro de funcionário encontrado para este mês." };
  }

  const hasIncompleteHistoricalGoals = operationalRecords.some((record) => {
    const hasEffectiveLitersSnapshot = toNum(record.finalGoalLiters) > 0;
    const hasBaseLitersInput = toNum(record.baseGoalLiters) > 0;
    const hasEffectiveStockSnapshot = toNum(record.effectiveStockGoal) > 0;
    const hasBaseStockInput = toNum(record.baseStockGoal) > 0 || toNum(record.stockGoalCommission) > 0;
    return (hasEffectiveLitersSnapshot && !hasBaseLitersInput)
      || (hasEffectiveStockSnapshot && !hasBaseStockInput);
  });

  if (hasIncompleteHistoricalGoals) {
    return {
      success: false,
      error: "Existem metas históricas incompletas neste período. O fechamento foi bloqueado para evitar perda de dados.",
    };
  }

  const unitSoldLiters = operationalRecords.reduce((sum, r) => sum + toNum(r.soldLiters), 0);

  const unitGoalLiters = toNum(metric.goalLiters);
  const unitMetLitersGoal = unitGoalLiters > 0 && unitSoldLiters >= unitGoalLiters;
  const resolvedRules = metric.commissionRuleSetId
    ? await getCommissionRulesById(metric.commissionRuleSetId)
    : await getCommissionRulesForPeriod({ year: input.year, month: input.month });

  await prisma.$transaction([
    ...operationalRecords.map((record) => {
      const calculation = calculateCommission({
        employmentType: record.employmentType,
        employeeShift: record.employeeShift,
        baseGoalLiters: toNum(record.baseGoalLiters),
        soldLiters: toNum(record.soldLiters),
        unitMetLitersGoal,
        soldStock: toNum(record.soldStock) || null,
        stockGoal: toNum(record.baseStockGoal ?? record.stockGoalCommission) || null,
        stockBaseCommission: toNum(record.stockCommission),
        dobras: toNum(record.dobras),
      }, resolvedRules.rules);

      return prisma.employeeMonthlyRecord.update({
        where: { id: record.id },
        data: {
          baseRate: calculation.baseRate,
          commissionEligible: calculation.eligible,
          minimumEligibilityPercentage: calculation.minimumEligibilityPercentage,
          ineligibilityReason: calculation.ineligibilityReason,
          baseCommission: calculation.baseCommission,
          finalGoalLiters: calculation.effectiveGoalLiters,
          effectiveStockGoal: calculation.effectiveStockGoal || null,
          litersMultiplier: calculation.litersMultiplier,
          bonusApplied: calculation.bonusApplied,
          bonusAmount: calculation.bonusAmount,
          totalCommission: calculation.totalCommission,
          stockMultiplier: calculation.stockMultiplier,
          finalTotalCommission: calculation.finalTotalCommission,
        },
      });
    }),
    prisma.unitMonthlyMetric.update({
      where: { id: metric.id },
      data: { closedAt: new Date(), commissionRuleSetId: resolvedRules.id },
    }),
  ]);

  revalidatePath("/", "layout");
  return { success: true };
}

export async function reopenMonth(input: CloseMonthInput): Promise<ActionResult> {
  if (!input.unitId?.trim()) {
    return { success: false, error: "ID da unidade é obrigatório." };
  }

  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    return { success: false, error: "Ano inválido." };
  }

  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    return { success: false, error: "Mês inválido." };
  }

  const metric = await prisma.unitMonthlyMetric.findUnique({
    where: { unitId_year_month: { unitId: input.unitId, year: input.year, month: input.month } },
    select: { id: true, closedAt: true },
  });

  if (!metric) {
    return { success: false, error: "Meta mensal da unidade não encontrada." };
  }

  if (!metric.closedAt) {
    return { success: false, error: "Este período não está fechado." };
  }

  await prisma.$transaction([
    prisma.employeeMonthlyRecord.updateMany({
      where: { unitId: input.unitId, year: input.year, month: input.month },
      data: {
        baseRate: null,
        commissionEligible: null,
        minimumEligibilityPercentage: null,
        ineligibilityReason: null,
        baseCommission: null,
        litersMultiplier: null,
        bonusApplied: false,
        bonusAmount: null,
        totalCommission: null,
        stockMultiplier: null,
        finalTotalCommission: null,
      },
    }),
    prisma.unitMonthlyMetric.update({
      where: { id: metric.id },
      data: { closedAt: null },
    }),
  ]);

  revalidatePath("/", "layout");
  return { success: true };
}
