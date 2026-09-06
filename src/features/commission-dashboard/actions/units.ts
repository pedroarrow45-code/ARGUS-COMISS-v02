"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

import type { ActionResult } from "../types/action-result";

type CreateUnitInput = {
  name: string;
  goal: number;
  result: number;
  year: number;
  month: number;
};

type UpdateUnitInput = {
  id: string;
  name: string;
  goal: number;
  result: number;
  year: number;
  month: number;
};

function validatePeriod(year: number, month: number): string | null {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return "Ano inválido.";
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return "Mês inválido.";
  }

  return null;
}

function validateAmounts(goal: number, result: number): string | null {
  if (typeof goal !== "number" || goal < 0) {
    return "Meta não pode ser negativa.";
  }

  if (typeof result !== "number" || result < 0) {
    return "Resultado não pode ser negativo.";
  }

  return null;
}

export async function createUnit(input: CreateUnitInput): Promise<ActionResult> {
  const name = input.name?.trim();

  if (!name) {
    return { success: false, error: "Nome da unidade é obrigatório." };
  }

  const periodError = validatePeriod(input.year, input.month);
  if (periodError) {
    return { success: false, error: periodError };
  }

  const amountsError = validateAmounts(input.goal, input.result);
  if (amountsError) {
    return { success: false, error: amountsError };
  }

  await prisma.$transaction(async (tx) => {
    const unit = await tx.unit.create({
      data: {
        name,
      },
    });

    await tx.unitMonthlyMetric.create({
      data: {
        unitId: unit.id,
        year: input.year,
        month: input.month,
        goalAmount: input.goal,
        resultAmount: input.result,
      },
    });
  });

  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateUnit(input: UpdateUnitInput): Promise<ActionResult> {
  if (!input.id || !input.id.trim()) {
    return { success: false, error: "ID da unidade é obrigatório." };
  }

  const name = input.name?.trim();

  if (!name) {
    return { success: false, error: "Nome da unidade é obrigatório." };
  }

  const periodError = validatePeriod(input.year, input.month);
  if (periodError) {
    return { success: false, error: periodError };
  }

  const amountsError = validateAmounts(input.goal, input.result);
  if (amountsError) {
    return { success: false, error: amountsError };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.unit.update({
        where: {
          id: input.id,
        },
        data: {
          name,
        },
      });

      await tx.unitMonthlyMetric.upsert({
        where: {
          unitId_year_month: {
            unitId: input.id,
            year: input.year,
            month: input.month,
          },
        },
        create: {
          unitId: input.id,
          year: input.year,
          month: input.month,
          goalAmount: input.goal,
          resultAmount: input.result,
        },
        update: {
          goalAmount: input.goal,
          resultAmount: input.result,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { success: false, error: "Unidade não encontrada." };
    }

    throw error;
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteUnit(id: string): Promise<ActionResult> {
  if (!id || !id.trim()) {
    return { success: false, error: "ID da unidade é obrigatório." };
  }

  try {
    await prisma.unit.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { success: false, error: "Unidade não encontrada." };
    }

    throw error;
  }

  revalidatePath("/", "layout");
  return { success: true };
}
