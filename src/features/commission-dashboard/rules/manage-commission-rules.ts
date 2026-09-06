import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type CommissionRuleSetChangeInput = {
  effectiveYear: number;
  effectiveMonth: number;
  permanentDaytimeRate: number;
  permanentNighttimeRate: number;
  probationDaytimeRate: number;
  probationNighttimeRate: number;
  probationGoalFactor: number;
  minimumEligibilityPercentage: number;
  neutralMultiplier: number;
  greenThreshold: number;
  greenMultiplier: number;
  blueThreshold: number;
  blueMultiplier: number;
  teamBonusFactor: number;
};

export type CommissionRuleSetDto = CommissionRuleSetChangeInput & {
  id: string;
  version: number;
  status: "ACTIVE" | "RETIRED";
  validFrom: string;
  validUntil: string | null;
};

export type CommissionRuleDifference = {
  field: Exclude<keyof CommissionRuleSetChangeInput, "effectiveYear" | "effectiveMonth">;
  before: number;
  after: number;
};

const numericFields = [
  "permanentDaytimeRate", "permanentNighttimeRate", "probationDaytimeRate", "probationNighttimeRate",
  "probationGoalFactor", "minimumEligibilityPercentage", "neutralMultiplier", "greenThreshold", "greenMultiplier", "blueThreshold",
  "blueMultiplier", "teamBonusFactor",
] as const;

function competenceDate(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Ano de vigência inválido.");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("Mês de vigência inválido.");
  return new Date(Date.UTC(year, month - 1, 1));
}

function decimalPlaces(value: number) {
  const text = value.toString().toLowerCase();
  if (text.includes("e-")) return Number(text.split("e-")[1]);
  return text.includes(".") ? text.split(".")[1].length : 0;
}

export function validateCommissionRuleSetChange(input: CommissionRuleSetChangeInput) {
  competenceDate(input.effectiveYear, input.effectiveMonth);
  for (const field of numericFields) {
    const value = input[field];
    if (!Number.isFinite(value)) throw new Error(`${field} deve ser finito.`);
    const scale = field.endsWith("Threshold") ? 2 : 4;
    if (decimalPlaces(value) > scale) throw new Error(`${field} excede a precisão de ${scale} casas.`);
  }
  for (const field of ["permanentDaytimeRate", "permanentNighttimeRate", "probationDaytimeRate", "probationNighttimeRate", "teamBonusFactor"] as const) {
    if (input[field] < 0) throw new Error(`${field} não pode ser negativo.`);
  }
  if (input.minimumEligibilityPercentage !== 100) throw new Error("minimumEligibilityPercentage deve ser 100; o fator de experiência define a meta aplicável.");
  if (input.probationGoalFactor <= 0) throw new Error("probationGoalFactor deve ser positivo.");
  if (input.greenThreshold <= 0 || input.blueThreshold <= 0 || input.greenThreshold >= input.blueThreshold) {
    throw new Error("Os limites devem ser positivos e greenThreshold menor que blueThreshold.");
  }
  if (input.neutralMultiplier <= 0 || input.greenMultiplier <= 0 || input.blueMultiplier <= 0) {
    throw new Error("Multiplicadores devem ser positivos.");
  }
  if (input.probationGoalFactor >= 100 || input.neutralMultiplier >= 100 || input.greenMultiplier >= 100 || input.blueMultiplier >= 100 || input.teamBonusFactor >= 100) {
    throw new Error("Fatores e multiplicadores excedem a capacidade técnica suportada.");
  }
  if (input.greenThreshold >= 100000 || input.blueThreshold >= 100000) throw new Error("Threshold excede a capacidade técnica suportada.");
}

function number(value: { toNumber(): number } | number) {
  return typeof value === "number" ? value : value.toNumber();
}

function dto(row: any): CommissionRuleSetDto {
  return {
    id: row.id, version: row.version, status: row.status,
    validFrom: row.validFrom.toISOString().slice(0, 10),
    validUntil: row.validUntil ? row.validUntil.toISOString().slice(0, 10) : null,
    effectiveYear: row.validFrom.getUTCFullYear(), effectiveMonth: row.validFrom.getUTCMonth() + 1,
    permanentDaytimeRate: number(row.daytimePermanentRate), permanentNighttimeRate: number(row.nighttimePermanentRate),
    probationDaytimeRate: number(row.daytimeProbationRate), probationNighttimeRate: number(row.nighttimeProbationRate),
    probationGoalFactor: number(row.probationGoalFactor), minimumEligibilityPercentage: number(row.minimumEligibilityPercentage), neutralMultiplier: number(row.neutralMultiplier),
    greenThreshold: number(row.greenMinimumPercentage), greenMultiplier: number(row.greenMultiplier),
    blueThreshold: number(row.blueMinimumPercentage), blueMultiplier: number(row.blueMultiplier),
    teamBonusFactor: number(row.teamBonusRate),
  };
}

export function compareCommissionRules(current: CommissionRuleSetChangeInput, next: CommissionRuleSetChangeInput): CommissionRuleDifference[] {
  return numericFields.flatMap((field) => current[field] === next[field] ? [] : [{ field, before: current[field], after: next[field] }]);
}

export async function createCommissionRuleSetVersion(input: CommissionRuleSetChangeInput, db: PrismaClient = prisma) {
  validateCommissionRuleSetChange(input);
  const validFrom = competenceDate(input.effectiveYear, input.effectiveMonth);
  try {
    return await db.$transaction(async (tx) => {
      const closedCount = await tx.unitMonthlyMetric.count({
        where: { closedAt: { not: null }, OR: [{ year: { gt: input.effectiveYear } }, { year: input.effectiveYear, month: { gte: input.effectiveMonth } }] },
      });
      if (closedCount > 0) throw new Error("A vigência alcança competência total ou parcialmente fechada.");
      const versions = await tx.commissionRuleSet.findMany({ orderBy: { version: "desc" } });
      const future = versions.find((row) => row.validFrom >= validFrom);
      if (future) throw new Error("A nova vigência sobrepõe uma versão existente ou futura.");
      const previous = versions.filter((row) => row.validFrom < validFrom).sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0];
      if (!previous) throw new Error("Não existe versão anterior para encerrar.");
      const validUntil = new Date(validFrom); validUntil.setUTCDate(validUntil.getUTCDate() - 1);
      await tx.commissionRuleSet.update({ where: { id: previous.id }, data: { validUntil, status: "RETIRED" } });
      const created = await tx.commissionRuleSet.create({ data: {
        version: (versions[0]?.version ?? 0) + 1, status: "ACTIVE", validFrom,
        daytimePermanentRate: input.permanentDaytimeRate, nighttimePermanentRate: input.permanentNighttimeRate,
        daytimeProbationRate: input.probationDaytimeRate, nighttimeProbationRate: input.probationNighttimeRate,
        probationGoalFactor: input.probationGoalFactor, minimumEligibilityPercentage: input.minimumEligibilityPercentage, neutralMultiplier: input.neutralMultiplier,
        greenMinimumPercentage: input.greenThreshold, greenMultiplier: input.greenMultiplier,
        blueMinimumPercentage: input.blueThreshold, blueMultiplier: input.blueMultiplier, teamBonusRate: input.teamBonusFactor,
      } });
      return dto(created);
    }, { isolationLevel: "Serializable" as any });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error.code === "P2002" || error.code === "P2034")) {
      throw new Error("Conflito concorrente ao criar a versão; recarregue as regras e tente novamente.");
    }
    throw error;
  }
}

export async function getCurrentCommissionRuleSet(db: PrismaClient = prisma, at = new Date()) {
  const reference = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const rows = await db.commissionRuleSet.findMany({ orderBy: { validFrom: "desc" } });
  const row = rows.find((candidate) => candidate.validFrom <= reference && (candidate.validUntil == null || candidate.validUntil >= reference));
  return row ? dto(row) : null;
}

export async function listCommissionRuleSetHistory(db: PrismaClient = prisma) {
  return (await db.commissionRuleSet.findMany({ orderBy: { version: "desc" } })).map(dto);
}
