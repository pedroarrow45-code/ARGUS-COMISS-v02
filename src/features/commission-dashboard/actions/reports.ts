"use server";

import {
  closeMonthlyCommissionPeriod as closeMonthlyCommissionPeriodAction,
  previewMonthlyCommissionClosure as previewMonthlyCommissionClosureAction,
} from "./monthly-closing";
import { getReportsOverview } from "../queries/reports";
import type { ReportsOverview } from "../types/reports-data";

export async function fetchReportsData(period: { year: number; month: number }): Promise<ReportsOverview> {
  if (!Number.isInteger(period.year) || period.year < 2000 || period.year > 2100) {
    throw new Error("Ano inválido.");
  }

  if (!Number.isInteger(period.month) || period.month < 1 || period.month > 12) {
    throw new Error("Mês inválido.");
  }

  return getReportsOverview(period);
}

export async function previewMonthlyCommissionClosure(period: { year: number; month: number }) {
  return previewMonthlyCommissionClosureAction(period);
}

export async function closeMonthlyCommissionPeriod(period: { year: number; month: number; closedAt?: Date }) {
  return closeMonthlyCommissionPeriodAction(period);
}
