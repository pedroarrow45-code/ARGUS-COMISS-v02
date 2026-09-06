"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

import type { ActionResult } from "../types/action-result";

type CreateEmployeeInput = {
  name: string;
  unitId: string;
  status: "ACTIVE" | "INACTIVE";
  shift: "DAYTIME" | "NIGHTTIME";
  employmentType: "PERMANENT" | "PROBATION";
};

type UpdateEmployeeInput = {
  id: string;
  name: string;
  unitId: string;
  status: "ACTIVE" | "INACTIVE";
  shift: "DAYTIME" | "NIGHTTIME";
  employmentType: "PERMANENT" | "PROBATION";
};

const VALID_STATUSES = ["ACTIVE", "INACTIVE"] as const;
const VALID_SHIFTS = ["DAYTIME", "NIGHTTIME"] as const;
const VALID_EMPLOYMENT_TYPES = ["PERMANENT", "PROBATION"] as const;

export async function createEmployee(input: CreateEmployeeInput): Promise<ActionResult> {
  const name = input.name?.trim();

  if (!name) {
    return { success: false, error: "Nome do funcionário é obrigatório." };
  }

  if (!input.unitId || !input.unitId.trim()) {
    return { success: false, error: "Unidade é obrigatória." };
  }

  if (!VALID_STATUSES.includes(input.status)) {
    return { success: false, error: "Status inválido." };
  }

  if (!VALID_SHIFTS.includes(input.shift)) {
    return { success: false, error: "Turno inválido." };
  }

  if (!VALID_EMPLOYMENT_TYPES.includes(input.employmentType)) {
    return { success: false, error: "Tipo de vínculo inválido." };
  }

  try {
    await prisma.employee.create({
      data: {
        name,
        unitId: input.unitId,
        status: input.status,
        shift: input.shift,
        employmentType: input.employmentType,
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

export async function updateEmployee(input: UpdateEmployeeInput): Promise<ActionResult> {
  if (!input.id || !input.id.trim()) {
    return { success: false, error: "ID do funcionário é obrigatório." };
  }

  const name = input.name?.trim();

  if (!name) {
    return { success: false, error: "Nome do funcionário é obrigatório." };
  }

  if (!input.unitId || !input.unitId.trim()) {
    return { success: false, error: "Unidade é obrigatória." };
  }

  if (!VALID_STATUSES.includes(input.status)) {
    return { success: false, error: "Status inválido." };
  }

  if (!VALID_SHIFTS.includes(input.shift)) {
    return { success: false, error: "Turno inválido." };
  }

  if (!VALID_EMPLOYMENT_TYPES.includes(input.employmentType)) {
    return { success: false, error: "Tipo de vínculo inválido." };
  }

  try {
    await prisma.employee.update({
      where: {
        id: input.id,
      },
      data: {
        name,
        unitId: input.unitId,
        status: input.status,
        shift: input.shift,
        employmentType: input.employmentType,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { success: false, error: "Funcionário não encontrado." };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { success: false, error: "Unidade não encontrada." };
    }

    throw error;
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  if (!id || !id.trim()) {
    return { success: false, error: "ID do funcionário é obrigatório." };
  }

  const recordCount = await prisma.employeeMonthlyRecord.count({
    where: { employeeId: id },
  });

  if (recordCount > 0) {
    await prisma.employee.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
    revalidatePath("/", "layout");
    return { success: true };
  }

  try {
    await prisma.employee.delete({
      where: {
        id,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { success: false, error: "Funcionário não encontrado." };
    }

    throw error;
  }

  revalidatePath("/", "layout");
  return { success: true };
}
