import { prisma } from "@/lib/prisma";

import type { UnitsOverview, UnitsPeriodInput } from "../types/units-data";
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

export async function getUnitsOverview(period: UnitsPeriodInput): Promise<UnitsOverview> {
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
            closedAt: true,
        },
        take: 1,
      },
      employeeMonthlyRecords: {
        where: {
          year: period.year,
          month: period.month,
        },
        select: {
          totalCommission: true,
          finalTotalCommission: true,
          unitId: true,
          employee: { select: { status: true, unitId: true } },
        },
      },
      _count: {
        select: {
          employees: { where: { status: "ACTIVE" } },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return {
    period,
    units: units.map((unit) => {
      const officialRecords = unit.employeeMonthlyRecords.filter((record) =>
        unit.monthlyMetrics[0] != null && (unit.monthlyMetrics[0].closedAt != null
          ? record.finalTotalCommission != null
          : record.employee.status === "ACTIVE" && record.employee.unitId === unit.id && record.unitId === unit.id),
      );

      return {
      id: unit.id,
      name: unit.name,
      goal: toNumber(unit.monthlyMetrics[0]?.goalAmount),
      result: toNumber(unit.monthlyMetrics[0]?.resultAmount),
      employeesCount: unit.monthlyMetrics[0]?.closedAt != null
        ? officialRecords.length
        : unit._count.employees,
      totalCommission: officialRecords.reduce(
        (sum, r) => sum + getOfficialCommissionValue(r),
        0,
      ),
    };
    }),
  };
}
