"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

import { getGoalsOverview } from "../queries/goals";
import type { ActionResult } from "../types/action-result";
import type { GoalsOverview } from "../types/goals-data";

export async function fetchGoalsData(period: { year: number; month: number }): Promise<GoalsOverview> {
  if (!Number.isInteger(period.year) || period.year < 2000 || period.year > 2100) {
    throw new Error("Ano inválido.");
  }

  if (!Number.isInteger(period.month) || period.month < 1 || period.month > 12) {
    throw new Error("Mês inválido.");
  }

  return getGoalsOverview(period);
}

type UpdateUnitMonthlyMetricInput = {
  unitId: string;
  year: number;
  month: number;
  goalAmount: number;
  resultAmount: number;
  goalLiters: number;
  goalStock: number;
  resultLiters: number;
  resultStock: number;
};

export async function updateUnitMonthlyMetric(input: UpdateUnitMonthlyMetricInput): Promise<ActionResult> {
  if (!input.unitId || !input.unitId.trim()) {
    return { success: false, error: "ID da unidade é obrigatório." };
  }

  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    return { success: false, error: "Ano inválido." };
  }

  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    return { success: false, error: "Mês inválido." };
  }

  if (typeof input.goalAmount !== "number" || input.goalAmount < 0) {
    return { success: false, error: "Meta não pode ser negativa." };
  }

  if (typeof input.resultAmount !== "number" || input.resultAmount < 0) {
    return { success: false, error: "Resultado não pode ser negativo." };
  }

  if (typeof input.goalLiters !== "number" || input.goalLiters < 0) {
    return { success: false, error: "Meta em litros não pode ser negativa." };
  }

  if (typeof input.goalStock !== "number" || input.goalStock < 0) {
    return { success: false, error: "Meta de estoque não pode ser negativa." };
  }

  if (typeof input.resultLiters !== "number" || input.resultLiters < 0) {
    return { success: false, error: "Resultado de litragem não pode ser negativo." };
  }

  if (typeof input.resultStock !== "number" || input.resultStock < 0) {
    return { success: false, error: "Resultado de estoque não pode ser negativo." };
  }

  const existing = await prisma.unitMonthlyMetric.findUnique({
    where: { unitId_year_month: { unitId: input.unitId, year: input.year, month: input.month } },
    select: { closedAt: true },
  });

  if (existing?.closedAt) {
    return { success: false, error: "Período fechado. Reabra antes de editar." };
  }

  try {
    await prisma.unitMonthlyMetric.upsert({
      where: {
        unitId_year_month: {
          unitId: input.unitId,
          year: input.year,
          month: input.month,
        },
      },
      create: {
        unitId: input.unitId,
        year: input.year,
        month: input.month,
        goalAmount: input.goalAmount,
        resultAmount: input.resultAmount,
        goalLiters: input.goalLiters,
        goalStock: input.goalStock,
        resultLiters: input.resultLiters,
        resultStock: input.resultStock,
      },
      update: {
        goalAmount: input.goalAmount,
        resultAmount: input.resultAmount,
        goalLiters: input.goalLiters,
        goalStock: input.goalStock,
        resultLiters: input.resultLiters,
        resultStock: input.resultStock,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { success: false, error: "Unidade não encontrada." };
    }

    throw error;
  }

  revalidatePath("/", "layout");
  return { success: true };
}
