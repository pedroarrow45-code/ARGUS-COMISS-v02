"use server";

import type { Prisma, PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

import { calculateCommission, calculateUnitCommissions, type EmployeeCommissionResult } from "../engine";
import type { ResolvedCommissionRules } from "../rules/get-commission-rules";
import { getCommissionRulesForPeriod } from "../rules/get-commission-rules";

type DecimalLike = {
  toNumber(): number;
};

type MonthlyPeriodInput = {
  year: number;
  month: number;
};

type CloseMonthlyCommissionInput = MonthlyPeriodInput & {
  closedAt?: Date;
};

type MonthlyCommissionUnitPreview = {
  unitId: string;
  unitName: string;
  unitGoalLiters: number;
  unitSoldLiters: number;
  unitMetGoal: boolean;
  allEligibleMetGoal: boolean;
  bonusUnlocked: boolean;
  employeeCount: number;
  totalCommission: number;
  employees: MonthlyEmployeeCommissionResult[];
};

type MonthlyEmployeeCommissionResult = EmployeeCommissionResult & {
  effectiveGoalLiters: number;
  effectiveStockGoal: number;
  stockMultiplier: number;
  finalTotalCommission: number;
};

type MonthlyCommissionPreview = {
  period: MonthlyPeriodInput;
  unitCount: number;
  employeeCount: number;
  units: MonthlyCommissionUnitPreview[];
};

export type PreviewMonthlyCommissionResult =
  | {
      success: true;
      preview: MonthlyCommissionPreview;
    }
  | {
      success: false;
      error: string;
    };

export type CloseMonthlyCommissionResult =
  | {
      success: true;
      summary: MonthlyCommissionPreview & {
        closedAt: string;
      };
    }
  | {
      success: false;
      error: string;
    };

type MonthlyMetricRow = {
  unitId: string;
  goalLiters: DecimalLike | null;
  goalStock: DecimalLike | null;
  resultStock: DecimalLike | null;
  closedAt: Date | null;
  unit: {
    name: string;
    employeeMonthlyRecords: Array<{
      employeeId: string;
      unitId: string;
      employmentType: "PERMANENT" | "PROBATION";
      employeeShift: "DAYTIME" | "NIGHTTIME";
      baseGoalLiters: DecimalLike;
      soldLiters: DecimalLike;
      soldStock: DecimalLike | null;
      stockCommission: DecimalLike | null;
      stockGoalCommission: DecimalLike | null;
      baseStockGoal: DecimalLike | null;
      dobras: DecimalLike | null;
      employee: { status: "ACTIVE" | "INACTIVE"; unitId: string };
    }>;
  };
};

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

function toNumber(value: DecimalLike | number | null | undefined): number {
  if (value == null) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return value.toNumber();
}

function validatePeriod(period: MonthlyPeriodInput): string | null {
  if (!Number.isInteger(period.year) || period.year < 2000 || period.year > 2100) {
    return "Ano inválido.";
  }

  if (!Number.isInteger(period.month) || period.month < 1 || period.month > 12) {
    return "Mês inválido.";
  }

  return null;
}

function formatUnitList(rows: MonthlyMetricRow[]): string {
  return rows.map((row) => row.unit.name).join(", ");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

type BuildPreviewOptions = {
  allowClosed?: boolean;
};

async function loadMonthlyMetrics(
  db: PrismaExecutor,
  period: MonthlyPeriodInput,
): Promise<MonthlyMetricRow[]> {
  return db.unitMonthlyMetric.findMany({
    where: {
      year: period.year,
      month: period.month,
    },
    select: {
      unitId: true,
      goalLiters: true,
      goalStock: true,
      resultStock: true,
      closedAt: true,
      unit: {
        select: {
          name: true,
          employeeMonthlyRecords: {
            where: {
              year: period.year,
              month: period.month,
            },
            select: {
              employeeId: true,
              unitId: true,
              employmentType: true,
              employeeShift: true,
              baseGoalLiters: true,
              soldLiters: true,
              soldStock: true,
              stockCommission: true,
              stockGoalCommission: true,
              baseStockGoal: true,
              dobras: true,
              employee: { select: { status: true, unitId: true } },
            },
            orderBy: {
              employeeId: "asc",
            },
          },
        },
      },
    },
    orderBy: {
      unit: {
        name: "asc",
      },
    },
  });
}

function buildPreview(
  period: MonthlyPeriodInput,
  rows: MonthlyMetricRow[],
  resolvedRules: ResolvedCommissionRules,
  options: BuildPreviewOptions = {},
): PreviewMonthlyCommissionResult {
  rows = rows.map((row) => ({
    ...row,
    unit: {
      ...row.unit,
      employeeMonthlyRecords: row.unit.employeeMonthlyRecords.filter(
        (record) => record.employee.status === "ACTIVE" && record.employee.unitId === row.unitId,
      ),
    },
  }));
  if (rows.length === 0) {
    return { success: false, error: "Nenhuma meta mensal foi encontrada para o período informado." };
  }

  const alreadyClosed = rows.filter((row) => row.closedAt != null);
  if (!options.allowClosed && alreadyClosed.length > 0) {
    return {
      success: false,
      error: `O período já está fechado para as unidades: ${formatUnitList(alreadyClosed)}.`,
    };
  }

  const missingGoalLiters = rows.filter((row) => toNumber(row.goalLiters) <= 0);
  if (missingGoalLiters.length > 0) {
    return {
      success: false,
      error: `Defina a meta coletiva em litros antes do fechamento nas unidades: ${formatUnitList(missingGoalLiters)}.`,
    };
  }

  const missingEmployeeRecords = rows.filter((row) => row.unit.employeeMonthlyRecords.length === 0);
  if (missingEmployeeRecords.length > 0) {
    return {
      success: false,
      error: `Não há EmployeeMonthlyRecord no período para as unidades: ${formatUnitList(missingEmployeeRecords)}.`,
    };
  }

  const mismatchedRecords = rows.filter((row) =>
    row.unit.employeeMonthlyRecords.some((record) => record.unitId !== row.unitId),
  );
  if (mismatchedRecords.length > 0) {
    return {
      success: false,
      error: `Existem registros mensais vinculados à unidade errada em: ${formatUnitList(mismatchedRecords)}.`,
    };
  }

  const units = rows.map((row) => {
    const employeesInput = row.unit.employeeMonthlyRecords.map((record) => ({
      employeeId: record.employeeId,
      employmentType: record.employmentType,
      shift: record.employeeShift,
      baseGoalLiters: toNumber(record.baseGoalLiters),
      soldLiters: toNumber(record.soldLiters),
    }));

    const unitSoldLiters = round2(
      employeesInput.reduce((sum, employee) => sum + employee.soldLiters, 0),
    );

    const collectiveCalculation = calculateUnitCommissions({
      unitGoalLiters: toNumber(row.goalLiters),
      unitSoldLiters,
      employees: employeesInput,
    }, resolvedRules.rules);
    const bonusUnlocked = collectiveCalculation.unitMetGoal;
    const employees: MonthlyEmployeeCommissionResult[] = row.unit.employeeMonthlyRecords.map((record) => {
      const calculation = calculateCommission({
        employmentType: record.employmentType,
        employeeShift: record.employeeShift,
        baseGoalLiters: toNumber(record.baseGoalLiters),
        soldLiters: toNumber(record.soldLiters),
        unitMetLitersGoal: bonusUnlocked,
        soldStock: record.soldStock ? toNumber(record.soldStock) : null,
        stockGoal: record.baseStockGoal ? toNumber(record.baseStockGoal) : record.stockGoalCommission ? toNumber(record.stockGoalCommission) : null,
        stockBaseCommission: toNumber(record.stockCommission),
        dobras: toNumber(record.dobras),
      }, resolvedRules.rules);
      return {
        employeeId: record.employeeId,
        completionPercent: calculation.achievementPercentage,
        metIndividualGoal: calculation.metIndividualGoal,
        eligible: calculation.eligible,
        minimumEligibilityPercentage: calculation.minimumEligibilityPercentage,
        ineligibilityReason: calculation.ineligibilityReason,
        baseRate: calculation.baseRate,
        baseCommission: calculation.baseCommission,
        effectiveGoalLiters: calculation.effectiveGoalLiters,
        effectiveStockGoal: calculation.effectiveStockGoal,
        litersMultiplier: calculation.litersMultiplier,
        bonusApplied: calculation.bonusApplied,
        bonusAmount: calculation.bonusAmount,
        totalCommission: calculation.totalCommission,
        stockMultiplier: calculation.stockMultiplier,
        finalTotalCommission: calculation.finalTotalCommission,
      };
    });

    return {
      unitId: row.unitId,
      unitName: row.unit.name,
      unitGoalLiters: toNumber(row.goalLiters),
      unitSoldLiters,
      unitMetGoal: collectiveCalculation.unitMetGoal,
      allEligibleMetGoal: collectiveCalculation.allEligibleMetGoal,
      bonusUnlocked,
      employeeCount: employees.length,
      totalCommission: round2(employees.reduce((sum, employee) => sum + employee.finalTotalCommission, 0)),
      employees,
    };
  });

  return {
    success: true,
    preview: {
      period,
      unitCount: units.length,
      employeeCount: units.reduce((sum, unit) => sum + unit.employeeCount, 0),
      units,
    },
  };
}

export async function previewMonthlyCommissionClosure(
  period: MonthlyPeriodInput,
): Promise<PreviewMonthlyCommissionResult> {
  const validationError = validatePeriod(period);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const rows = await loadMonthlyMetrics(prisma, period);
  const alreadyClosed = rows.filter((row) => row.closedAt != null);
  if (alreadyClosed.length > 0) {
    return { success: false, error: `O período já está fechado para as unidades: ${formatUnitList(alreadyClosed)}.` };
  }
  const resolvedRules = await getCommissionRulesForPeriod(period);
  return buildPreview(period, rows, resolvedRules);
}

export async function closeMonthlyCommissionPeriod(
  input: CloseMonthlyCommissionInput,
): Promise<CloseMonthlyCommissionResult> {
  const validationError = validatePeriod(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const closedAt = input.closedAt ?? new Date();

  const summary = await prisma.$transaction(async (tx) => {
    const rows = await loadMonthlyMetrics(tx, input);
    const resolvedRules = await getCommissionRulesForPeriod(input, tx);
    const previewResult = buildPreview(input, rows, resolvedRules);

    if (!previewResult.success) {
      throw new Error(previewResult.error);
    }

    for (const unit of previewResult.preview.units) {
      for (const employee of unit.employees) {
        await tx.employeeMonthlyRecord.update({
          where: {
            employeeId_year_month: {
              employeeId: employee.employeeId,
              year: input.year,
              month: input.month,
            },
          },
          data: {
            baseRate: employee.baseRate,
            commissionEligible: employee.eligible,
            minimumEligibilityPercentage: employee.minimumEligibilityPercentage,
            ineligibilityReason: employee.ineligibilityReason,
            baseCommission: employee.baseCommission,
            finalGoalLiters: employee.effectiveGoalLiters,
            effectiveStockGoal: employee.effectiveStockGoal || null,
            litersMultiplier: employee.litersMultiplier,
            bonusApplied: employee.bonusApplied,
            bonusAmount: employee.bonusAmount,
            totalCommission: employee.totalCommission,
            stockMultiplier: employee.stockMultiplier,
            finalTotalCommission: employee.finalTotalCommission,
          },
        });
      }

      await tx.unitMonthlyMetric.update({
        where: {
          unitId_year_month: {
            unitId: unit.unitId,
            year: input.year,
            month: input.month,
          },
        },
        data: {
          closedAt,
          commissionRuleSetId: resolvedRules.id,
        },
      });
    }

    return {
      ...previewResult.preview,
      closedAt: closedAt.toISOString(),
    };
  }).catch((error: unknown) => {
    if (error instanceof Error) {
      return { error: error.message };
    }

    throw error;
  });

  if ("error" in summary) {
    return { success: false, error: summary.error };
  }

  revalidatePath("/", "layout");
  return { success: true, summary };
}
