import { prisma } from "@/lib/prisma";

import type { EmployeesOverview, EmployeesPeriodInput } from "../types/employees-data";
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

export async function getEmployeesOverview(period: EmployeesPeriodInput): Promise<EmployeesOverview> {
  const [employees, units] = await Promise.all([
    prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        unit: {
          isActive: true,
        },
      },
      select: {
        id: true,
        name: true,
        unitId: true,
        status: true,
        shift: true,
        employmentType: true,
        monthlyRecords: {
          where: {
            year: period.year,
            month: period.month,
          },
          select: {
            totalCommission: true,
            finalTotalCommission: true,
          },
          take: 1,
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.unit.findMany({
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
          },
          take: 1,
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return {
    period,
    employees: employees.map((employee) => {
      const record = employee.monthlyRecords[0];
      return {
        id: employee.id,
        name: employee.name,
        unitId: employee.unitId,
        status: employee.status === "ACTIVE" ? ("ativo" as const) : ("inativo" as const),
        shift: employee.shift === "DAYTIME" ? ("diurno" as const) : ("noturno" as const),
        employmentType: employee.employmentType === "PERMANENT" ? ("efetivado" as const) : ("experiencia" as const),
        totalCommission: record ? getOfficialCommissionValue(record) : null,
      };
    }),
    units: units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      goal: toNumber(unit.monthlyMetrics[0]?.goalAmount),
      result: toNumber(unit.monthlyMetrics[0]?.resultAmount),
    })),
  };
}
