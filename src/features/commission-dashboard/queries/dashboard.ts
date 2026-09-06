import { prisma } from "@/lib/prisma";

import type {
  DashboardHistoryItem,
  DashboardOverview,
  DashboardPeriodInput,
  DashboardRankingItem,
} from "../types/dashboard-data";
import { getOfficialCommissionValue } from "./official-commission";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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

function buildMonthSequence(period: DashboardPeriodInput, totalMonths: number) {
  const months: Array<{ year: number; month: number }> = [];

  for (let offset = totalMonths - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(period.year, period.month - 1, 1));
    date.setUTCMonth(date.getUTCMonth() - offset);

    months.push({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
    });
  }

  return months;
}

export async function getNetworkGoalTotalByPeriod(period: DashboardPeriodInput) {
  const aggregate = await prisma.unitMonthlyMetric.aggregate({
    _sum: {
      goalAmount: true,
    },
    where: {
      year: period.year,
      month: period.month,
      unit: {
        isActive: true,
      },
    },
  });

  return toNumber(aggregate._sum.goalAmount);
}

export async function getNetworkResultTotalByPeriod(period: DashboardPeriodInput) {
  const aggregate = await prisma.unitMonthlyMetric.aggregate({
    _sum: {
      resultAmount: true,
    },
    where: {
      year: period.year,
      month: period.month,
      unit: {
        isActive: true,
      },
    },
  });

  return toNumber(aggregate._sum.resultAmount);
}

export async function getNetworkCompletionPercentByPeriod(period: DashboardPeriodInput) {
  const [goalAmount, resultAmount] = await Promise.all([
    getNetworkGoalTotalByPeriod(period),
    getNetworkResultTotalByPeriod(period),
  ]);

  if (goalAmount <= 0) {
    return 0;
  }

  return Number(((resultAmount / goalAmount) * 100).toFixed(1));
}

export async function getNetworkGoalLitersTotalByPeriod(period: DashboardPeriodInput) {
  const aggregate = await prisma.unitMonthlyMetric.aggregate({
    _sum: {
      goalLiters: true,
    },
    where: {
      year: period.year,
      month: period.month,
      unit: {
        isActive: true,
      },
    },
  });

  return toNumber(aggregate._sum.goalLiters);
}

export async function getNetworkResultLitersTotalByPeriod(period: DashboardPeriodInput) {
  const aggregate = await prisma.unitMonthlyMetric.aggregate({
    _sum: {
      resultLiters: true,
    },
    where: {
      year: period.year,
      month: period.month,
      unit: {
        isActive: true,
      },
    },
  });

  return toNumber(aggregate._sum.resultLiters);
}

export async function getActiveEmployeesCount() {
  return prisma.employee.count({
    where: {
      status: "ACTIVE",
      unit: {
        isActive: true,
      },
    },
  });
}

export async function getNetworkGoalStockTotalByPeriod(period: DashboardPeriodInput) {
  const aggregate = await prisma.unitMonthlyMetric.aggregate({
    _sum: {
      goalStock: true,
    },
    where: {
      year: period.year,
      month: period.month,
      unit: {
        isActive: true,
      },
    },
  });

  return toNumber(aggregate._sum.goalStock);
}

export async function getNetworkCommissionTotalByPeriod(period: DashboardPeriodInput) {
  const records = await prisma.employeeMonthlyRecord.findMany({
    where: {
      year: period.year,
      month: period.month,
      unit: { isActive: true },
    },
    select: {
      unitId: true,
      finalTotalCommission: true,
      totalCommission: true,
      employee: { select: { status: true, unitId: true } },
      unit: { select: { monthlyMetrics: { where: period, select: { closedAt: true }, take: 1 } } },
    },
  });

  return records.filter((record) => {
    const metric = record.unit.monthlyMetrics[0];
    return metric != null && (metric.closedAt != null
      ? record.finalTotalCommission != null
      : record.employee.status === "ACTIVE" && record.employee.unitId === record.unitId);
  }).reduce(
    (sum, record) => sum + getOfficialCommissionValue(record),
    0,
  );
}

async function getCommissionByUnit(period: DashboardPeriodInput) {
  const rows = await prisma.employeeMonthlyRecord.findMany({
    where: { year: period.year, month: period.month, unit: { isActive: true } },
    select: {
      unitId: true,
      finalTotalCommission: true,
      totalCommission: true,
      employee: { select: { status: true, unitId: true } },
      unit: { select: { monthlyMetrics: { where: period, select: { closedAt: true }, take: 1 } } },
    },
  });

  return rows.filter((row) => {
    const metric = row.unit.monthlyMetrics[0];
    return metric != null && (metric.closedAt != null
      ? row.finalTotalCommission != null
      : row.employee.status === "ACTIVE" && row.employee.unitId === row.unitId);
  }).reduce<Map<string, number>>((map, row) => {
    map.set(row.unitId, (map.get(row.unitId) ?? 0) + getOfficialCommissionValue(row));
    return map;
  }, new Map());
}

export async function getUnitsRankingByPeriod(
  period: DashboardPeriodInput,
  options?: { limit?: number },
): Promise<DashboardRankingItem[]> {
  const [metrics, commissionMap] = await Promise.all([
    prisma.unitMonthlyMetric.findMany({
      where: {
        year: period.year,
        month: period.month,
        unit: {
          isActive: true,
        },
      },
      select: {
        unitId: true,
        goalAmount: true,
        resultAmount: true,
        goalLiters: true,
        resultLiters: true,
        unit: {
          select: {
            name: true,
          },
        },
      },
    }),
    getCommissionByUnit(period),
  ]);

  const ranking = metrics
    .map((metric) => {
      const goalAmount = toNumber(metric.goalAmount);
      const resultAmount = toNumber(metric.resultAmount);
      const goalLiters = toNumber(metric.goalLiters);
      const resultLiters = toNumber(metric.resultLiters);
      const completionPercent = goalLiters > 0 ? Number(((resultLiters / goalLiters) * 100).toFixed(1)) : 0;

      return {
        unitId: metric.unitId,
        unitName: metric.unit.name,
        goalAmount,
        resultAmount,
        goalLiters,
        resultLiters,
        completionPercent,
        totalCommission: commissionMap.get(metric.unitId) ?? 0,
      };
    })
    .sort((current, next) => next.completionPercent - current.completionPercent);

  return typeof options?.limit === "number" ? ranking.slice(0, options.limit) : ranking;
}

export async function getMonthlyGoalVsResultHistory(
  period: DashboardPeriodInput,
  options?: { months?: number },
): Promise<Omit<DashboardHistoryItem, "goalLiters" | "resultLiters">[]> {
  const totalMonths = options?.months ?? 6;
  const sequence = buildMonthSequence(period, totalMonths);
  const validKeys = new Set(sequence.map(({ year, month }) => `${year}-${month}`));
  const years = [...new Set(sequence.map(({ year }) => year))];

  const rows = await prisma.unitMonthlyMetric.findMany({
    where: {
      unit: {
        isActive: true,
      },
      year: {
        in: years,
      },
    },
    select: {
      year: true,
      month: true,
      goalAmount: true,
      resultAmount: true,
    },
  });

  const grouped = new Map<string, { goalAmount: number; resultAmount: number }>();

  for (const row of rows) {
    const key = `${row.year}-${row.month}`;

    if (!validKeys.has(key)) {
      continue;
    }

    const current = grouped.get(key) ?? { goalAmount: 0, resultAmount: 0 };

    current.goalAmount += toNumber(row.goalAmount);
    current.resultAmount += toNumber(row.resultAmount);
    grouped.set(key, current);
  }

  return sequence.map(({ year, month }) => {
    const key = `${year}-${month}`;
    const values = grouped.get(key) ?? { goalAmount: 0, resultAmount: 0 };

    return {
      year,
      month,
      label: MONTH_LABELS[month - 1] ?? `${month}`,
      goalAmount: values.goalAmount,
      resultAmount: values.resultAmount,
    };
  });
}

export async function getMonthlyGoalVsResultLitersHistory(
  period: DashboardPeriodInput,
  options?: { months?: number },
): Promise<Array<{ year: number; month: number; goalLiters: number; resultLiters: number }>> {
  const totalMonths = options?.months ?? 6;
  const sequence = buildMonthSequence(period, totalMonths);
  const validKeys = new Set(sequence.map(({ year, month }) => `${year}-${month}`));
  const years = [...new Set(sequence.map(({ year }) => year))];

  const rows = await prisma.employeeMonthlyRecord.findMany({
    where: {
      unit: {
        isActive: true,
      },
      year: {
        in: years,
      },
    },
    select: {
      year: true,
      month: true,
      soldLiters: true,
      finalGoalLiters: true,
      finalTotalCommission: true,
      unitId: true,
      employee: { select: { status: true, unitId: true } },
      unit: {
        select: {
          monthlyMetrics: {
            where: { year: { in: years } },
            select: { year: true, month: true, closedAt: true },
          },
        },
      },
    },
  });

  const grouped = new Map<string, { goalLiters: number; resultLiters: number }>();

  for (const row of rows) {
    const key = `${row.year}-${row.month}`;

    if (!validKeys.has(key)) {
      continue;
    }

    const metric = row.unit.monthlyMetrics.find((candidate) =>
      candidate.year === row.year && candidate.month === row.month,
    );
    if (!metric || (metric.closedAt != null
      ? row.finalTotalCommission == null
      : row.employee.status !== "ACTIVE" || row.employee.unitId !== row.unitId)) {
      continue;
    }

    const current = grouped.get(key) ?? { goalLiters: 0, resultLiters: 0 };

    current.goalLiters += toNumber(row.finalGoalLiters);
    current.resultLiters += toNumber(row.soldLiters);
    grouped.set(key, current);
  }

  return sequence.map(({ year, month }) => {
    const key = `${year}-${month}`;
    const values = grouped.get(key) ?? { goalLiters: 0, resultLiters: 0 };

    return {
      year,
      month,
      goalLiters: values.goalLiters,
      resultLiters: values.resultLiters,
    };
  });
}

export async function getDashboardOverview(
  period: DashboardPeriodInput,
  options?: { historyMonths?: number; rankingLimit?: number },
): Promise<DashboardOverview> {
  const [
    totalGoalAmount,
    totalResultAmount,
    totalGoalLiters,
    totalResultLiters,
    totalCommissionAmount,
    totalGoalStock,
    activeEmployeesCount,
    ranking,
    historyAmounts,
    historyLiters,
  ] = await Promise.all([
    getNetworkGoalTotalByPeriod(period),
    getNetworkResultTotalByPeriod(period),
    getNetworkGoalLitersTotalByPeriod(period),
    getNetworkResultLitersTotalByPeriod(period),
    getNetworkCommissionTotalByPeriod(period),
    getNetworkGoalStockTotalByPeriod(period),
    getActiveEmployeesCount(),
    getUnitsRankingByPeriod(period, { limit: options?.rankingLimit }),
    getMonthlyGoalVsResultHistory(period, { months: options?.historyMonths }),
    getMonthlyGoalVsResultLitersHistory(period, { months: options?.historyMonths }),
  ]);

  const completionPercent =
    totalGoalAmount > 0 ? Number(((totalResultAmount / totalGoalAmount) * 100).toFixed(1)) : 0;

  const completionPercentLiters =
    totalGoalLiters > 0 ? Number(((totalResultLiters / totalGoalLiters) * 100).toFixed(1)) : 0;

  const history = historyAmounts.map((item, index) => ({
    ...item,
    goalLiters: historyLiters[index]?.goalLiters ?? 0,
    resultLiters: historyLiters[index]?.resultLiters ?? 0,
  }));

  return {
    period,
    totalGoalAmount,
    totalResultAmount,
    completionPercent,
    totalGoalLiters,
    totalResultLiters,
    completionPercentLiters,
    totalCommissionAmount,
    totalGoalStock,
    activeEmployeesCount,
    ranking,
    history,
  };
}
