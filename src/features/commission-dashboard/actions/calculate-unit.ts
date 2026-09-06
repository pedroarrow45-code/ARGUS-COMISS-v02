"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

import { calculateUnitCommissions } from "../engine/calculate-commissions";
import type { EmployeeRecordInput } from "../engine/types";
import type { ActionResult } from "../types/action-result";
import { getCommissionRulesForPeriod } from "../rules/get-commission-rules";

type DecimalLike = { toNumber(): number };

function toNum(value: DecimalLike | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return value.toNumber();
}

type CalculateUnitInput = {
  unitId: string;
  year: number;
  month: number;
};

export async function calculateAndPersistUnit(input: CalculateUnitInput): Promise<ActionResult> {
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
    select: { goalLiters: true, closedAt: true },
  });

  if (!metric) {
    return { success: false, error: "Meta mensal da unidade não encontrada." };
  }

  if (metric.closedAt) {
    return { success: false, error: "Período fechado. Reabra antes de recalcular." };
  }

  const records = await prisma.employeeMonthlyRecord.findMany({
    where: { unitId: input.unitId, year: input.year, month: input.month },
    select: {
      id: true,
      employeeId: true,
      employmentType: true,
      employeeShift: true,
      baseGoalLiters: true,
      soldLiters: true,
      employee: { select: { status: true, unitId: true } },
    },
  });

  const operationalRecords = records.filter(
    (record) => record.employee.status === "ACTIVE" && record.employee.unitId === input.unitId,
  );

  if (operationalRecords.length === 0) {
    return { success: false, error: "Nenhum registro de funcionário encontrado para este mês." };
  }

  const unitSoldLiters = operationalRecords.reduce((sum, r) => sum + toNum(r.soldLiters), 0);

  const employees: EmployeeRecordInput[] = operationalRecords.map((r) => ({
    employeeId: r.employeeId,
    employmentType: r.employmentType,
    shift: r.employeeShift,
    baseGoalLiters: toNum(r.baseGoalLiters),
    soldLiters: toNum(r.soldLiters),
  }));

  const resolvedRules = await getCommissionRulesForPeriod({ year: input.year, month: input.month });
  const result = calculateUnitCommissions({
    unitGoalLiters: toNum(metric.goalLiters),
    unitSoldLiters,
    employees,
  }, resolvedRules.rules);

  const idByEmployee = new Map(operationalRecords.map((r) => [r.employeeId, r.id]));

  await prisma.$transaction(
    result.employees.map((emp) =>
      prisma.employeeMonthlyRecord.update({
        where: { id: idByEmployee.get(emp.employeeId)! },
        data: {
          baseRate: emp.baseRate,
          baseCommission: emp.baseCommission,
          bonusApplied: emp.bonusApplied,
          bonusAmount: emp.bonusAmount,
          totalCommission: emp.totalCommission,
        },
      }),
    ),
  );

  revalidatePath("/", "layout");
  return { success: true };
}
