import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { CommissionRules } from "../engine/calculate-commission";

type Executor = PrismaClient | Prisma.TransactionClient;
type DecimalLike = { toNumber(): number };

export type ResolvedCommissionRules = {
  id: string;
  version: number;
  rules: CommissionRules;
};

function periodReferenceDate(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Competência inválida para resolução das regras de comissão.");
  }
  return new Date(Date.UTC(year, month - 1, 1));
}

function number(value: DecimalLike | number) {
  return typeof value === "number" ? value : value.toNumber();
}

function resolveRow(row: any): ResolvedCommissionRules {
  return {
    id: row.id,
    version: row.version,
    rules: {
      rates: {
        DAYTIME: { PERMANENT: number(row.daytimePermanentRate), PROBATION: number(row.daytimeProbationRate) },
        NIGHTTIME: { PERMANENT: number(row.nighttimePermanentRate), PROBATION: number(row.nighttimeProbationRate) },
      },
      probationGoalFactor: number(row.probationGoalFactor),
      minimumEligibilityPercentage: number(row.minimumEligibilityPercentage),
      teamBonusRate: number(row.teamBonusRate),
      zones: {
        neutralMultiplier: number(row.neutralMultiplier), greenMinimumPercentage: number(row.greenMinimumPercentage),
        greenMultiplier: number(row.greenMultiplier), blueMinimumPercentage: number(row.blueMinimumPercentage),
        blueMultiplier: number(row.blueMultiplier),
      },
    },
  };
}

export async function getCommissionRulesById(id: string, db: Executor = prisma) {
  const row = await db.commissionRuleSet.findUnique({ where: { id } });
  if (!row) throw new Error("Regra vinculada ao fechamento não encontrada.");
  return resolveRow(row);
}

export async function getCommissionRulesForPeriod(
  period: { year: number; month: number },
  db: Executor = prisma,
): Promise<ResolvedCommissionRules> {
  // Não há tenant no schema atual: a resolução é global para a única rede da instalação.
  const referenceDate = periodReferenceDate(period.year, period.month);
  const matches = await db.commissionRuleSet.findMany({
    where: {
      validFrom: { lte: referenceDate },
      OR: [{ validUntil: null }, { validUntil: { gte: referenceDate } }],
    },
    orderBy: [{ validFrom: "desc" }, { version: "desc" }],
    take: 2,
  });

  if (matches.length === 0) throw new Error("Nenhuma regra de comissão vigente para a competência.");
  if (matches.length > 1) throw new Error("Mais de uma regra de comissão vigente para a competência.");
  return resolveRow(matches[0]);
}
