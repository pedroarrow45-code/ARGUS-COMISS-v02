import { prisma } from "@/lib/prisma";

import type { GoalsOverview, GoalsPeriodInput } from "../types/goals-data";
import { getOfficialCommissionValue } from "./official-commission";

type DecimalLike = {
  toNumber(): number;
};

function toNumber(value: DecimalLike | number | null | undefined) {
  if (value == null) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return value.toNumber();
}

export async function getGoalsOverview(period: GoalsPeriodInput): Promise<GoalsOverview> {
  const records = await prisma.employeeMonthlyRecord.findMany({
    where: { year: period.year, month: period.month },
    select: {
      unitId: true,
      totalCommission: true,
      finalTotalCommission: true,
      baseCommission: true,
      bonusAmount: true,
      bonusApplied: true,
      employee: { select: { status: true, unitId: true } },
    },
  });

  type UnitAgg = {
    totalCommission: number;
    totalBaseCommission: number;
    totalBonusAmount: number;
    bonusApplied: boolean;
  };

  const units = await prisma.unit.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      monthlyMetrics: {
        where: {
          year: period.year,
          month: period.month,
        },
        select: {
          goalAmount: true,
          resultAmount: true,
          goalLiters: true,
          goalStock: true,
          resultLiters: true,
          resultStock: true,
          closedAt: true,
        },
        take: 1,
      },
      _count: {
        select: {
          employees: {
            where: {
              status: "ACTIVE",
            },
          },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const closedByUnitId = new Map(units.map((unit) => [unit.id, unit.monthlyMetrics[0]?.closedAt != null]));
  const aggMap = new Map<string, UnitAgg>();

  for (const r of records) {
    const closed = closedByUnitId.get(r.unitId);
    if (closed == null || (closed
      ? r.finalTotalCommission == null
      : r.employee.status !== "ACTIVE" || r.employee.unitId !== r.unitId)) continue;

    const existing = aggMap.get(r.unitId) ?? {
      totalCommission: 0,
      totalBaseCommission: 0,
      totalBonusAmount: 0,
      bonusApplied: false,
    };

    existing.totalCommission += getOfficialCommissionValue(r);
    existing.totalBaseCommission += toNumber(r.baseCommission);
    existing.totalBonusAmount += toNumber(r.bonusAmount);
    if (r.bonusApplied) existing.bonusApplied = true;

    aggMap.set(r.unitId, existing);
  }

  const inheritedMetrics = await Promise.all(
    units.map(async (unit) => {
      if (unit.monthlyMetrics[0]) {
        return [unit.id, null] as const;
      }

      const latestPrevious = await prisma.unitMonthlyMetric.findFirst({
        where: {
          unitId: unit.id,
          OR: [
            { year: { lt: period.year } },
            { year: period.year, month: { lt: period.month } },
          ],
        },
        select: {
          goalAmount: true,
          goalLiters: true,
          goalStock: true,
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      });

      return [unit.id, latestPrevious] as const;
    }),
  );

  const inheritedByUnitId = new Map(inheritedMetrics);

  return {
    period,
    units: units.map((unit) => {
      const currentMetric = unit.monthlyMetrics[0];
      const inheritedMetric = inheritedByUnitId.get(unit.id);

      return {
      unitId: unit.id,
      unitName: unit.name,
      goalAmount: toNumber(currentMetric?.goalAmount ?? inheritedMetric?.goalAmount),
      resultAmount: toNumber(currentMetric?.resultAmount),
      goalLiters: toNumber(currentMetric?.goalLiters ?? inheritedMetric?.goalLiters),
      goalStock: toNumber(currentMetric?.goalStock ?? inheritedMetric?.goalStock),
      resultLiters: toNumber(currentMetric?.resultLiters),
      resultStock: toNumber(currentMetric?.resultStock),
      activeEmployeesCount: unit._count.employees,
      totalCommission: aggMap.get(unit.id)?.totalCommission ?? 0,
      totalBaseCommission: aggMap.get(unit.id)?.totalBaseCommission ?? 0,
      totalBonusAmount: aggMap.get(unit.id)?.totalBonusAmount ?? 0,
      bonusApplied: aggMap.get(unit.id)?.bonusApplied ?? false,
      closedAt: currentMetric?.closedAt?.toISOString() ?? null,
    };
    }),
  };
}
