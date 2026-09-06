"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

import { calculateStockCommission } from "../engine/calculate-stock-commission";
import { resolveGoalDisplaySnapshot } from "../engine/commission-display-snapshot";
import { getCommissionRulesById, getCommissionRulesForPeriod } from "../rules/get-commission-rules";
import { getOfficialCommissionValue } from "../queries/official-commission";
import type { ActionResult } from "../types/action-result";
import type { UnitMonthlyDetail, EmployeeRecordRow } from "../types/unit-detail-data";

// ── fetch ───────────────────────────────────────────────────────────

type FetchResult =
  | { success: true; data: UnitMonthlyDetail }
  | { success: false; error: string };

export async function findLatestPreviousBASEGoal(employeeId: string, year: number, month: number) {
  const periodWhere = {
    employeeId,
    OR: [{ year: { lt: year } }, { year, month: { lt: month } }],
  } satisfies Prisma.EmployeeMonthlyRecordWhereInput;

  const [latestLitersGoal, latestStockGoal] = await Promise.all([
    prisma.employeeMonthlyRecord.findFirst({
      where: {
        ...periodWhere,
        baseGoalLiters: { gt: 0 },
      },
      select: {
        baseGoalLiters: true,
        baseStockGoal: true,
        year: true,
        month: true,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
    prisma.employeeMonthlyRecord.findFirst({
      where: {
        ...periodWhere,
        baseStockGoal: { gt: 0 },
      },
      select: {
        baseStockGoal: true,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
  ]);

  if (!latestLitersGoal && !latestStockGoal) {
    return null;
  }

  return {
    baseGoalLiters: latestLitersGoal ? Number(latestLitersGoal.baseGoalLiters) : null,
    baseGoalLitersSource: latestLitersGoal ? { year: latestLitersGoal.year, month: latestLitersGoal.month } : null,
    baseStockGoal:
      latestStockGoal?.baseStockGoal !== null && latestStockGoal?.baseStockGoal !== undefined
        ? Number(latestStockGoal.baseStockGoal)
        : null,
  };
}

async function findLatestPreviousUnitGoals(unitId: string, year: number, month: number) {
  return prisma.unitMonthlyMetric.findFirst({
    where: {
      unitId,
      OR: [{ year: { lt: year } }, { year, month: { lt: month } }],
    },
    select: {
      goalAmount: true,
      goalLiters: true,
      goalStock: true,
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

/** Escrita explicita e idempotente para inicializar um periodo aberto. */
export async function ensureOpenMonthlyRecords(unitId: string, year: number, month: number): Promise<ActionResult> {
  const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { isActive: true } });
  if (!unit?.isActive) return { success: false, error: "Unidade não encontrada." };
  let metric = await prisma.unitMonthlyMetric.findUnique({
    where: { unitId_year_month: { unitId, year, month } },
    select: { closedAt: true, commissionRuleSetId: true },
  });
  if (!metric) {
    const previous = await findLatestPreviousUnitGoals(unitId, year, month);
    if (!previous) return { success: false, error: "MISSING_BASE_GOAL_SOURCE" };
    await prisma.unitMonthlyMetric.create({ data: { unitId, year, month, ...previous, resultAmount: 0 } });
    metric = { closedAt: null, commissionRuleSetId: null };
  }
  if (metric.closedAt) return { success: true };

  const employees = await prisma.employee.findMany({
    where: { unitId, status: "ACTIVE" },
    select: { id: true, shift: true, employmentType: true },
  });
  const existing = await prisma.employeeMonthlyRecord.findMany({
    where: { unitId, year, month },
    select: { employeeId: true, baseGoalLiters: true },
  });
  const ids = new Set(existing.map((record) => record.employeeId));
  const missing = employees.filter((employee) => !ids.has(employee.id));
  const inherited = await Promise.all(missing.map(async (employee) => ({
    employee,
    goals: await findLatestPreviousBASEGoal(employee.id, year, month),
  })));
  if (inherited.length) {
    await prisma.employeeMonthlyRecord.createMany({
      data: inherited.map(({ employee, goals }) => ({
        employeeId: employee.id, unitId, year, month,
        employmentType: employee.employmentType, employeeShift: employee.shift,
        baseGoalLiters: goals?.baseGoalLiters ?? 0,
        finalGoalLiters: 0,
        baseStockGoal: goals?.baseStockGoal ?? null,
        stockGoalCommission: goals?.baseStockGoal ?? null,
        goalSource: "AUTOMATIC", soldLiters: 0,
      })),
      skipDuplicates: true,
    });
  }
  // Registros operacionais podem ter sido materializados antes de existir uma meta
  // base válida. Reidrata somente o campo zerado a partir do último base positivo.
  if (!metric.commissionRuleSetId) {
    const activeEmployeeIds = new Set(employees.map((employee) => employee.id));
    const existingWithoutBaseGoal = existing.filter(
      (record) => activeEmployeeIds.has(record.employeeId) && Number(record.baseGoalLiters) <= 0,
    );
    const repairs = await Promise.all(existingWithoutBaseGoal.map(async (record) => ({
      record,
      goals: await findLatestPreviousBASEGoal(record.employeeId, year, month),
    })));
    await Promise.all(repairs.map(({ record, goals }) => {
      if (goals?.baseGoalLiters == null || goals.baseGoalLiters <= 0) return Promise.resolve();
      return prisma.employeeMonthlyRecord.updateMany({
        where: { employeeId: record.employeeId, year, month, baseGoalLiters: { lte: 0 } },
        data: { baseGoalLiters: goals.baseGoalLiters },
      });
    }));
  }
  // Nunca sincronize cadastro em periodo historico reaberto.
  if (!metric.commissionRuleSetId) {
    await Promise.all(employees.map((employee) => prisma.employeeMonthlyRecord.updateMany({
      where: { employeeId: employee.id, year, month },
      data: { employmentType: employee.employmentType, employeeShift: employee.shift },
    })));
  }
  return { success: true };
}

export async function fetchUnitMonthlyDetail(
  unitId: string,
  year: number,
  month: number,
): Promise<FetchResult> {
  if (!unitId || !unitId.trim()) {
    return { success: false, error: "ID da unidade é obrigatório." };
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { success: false, error: "Ano inválido." };
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { success: false, error: "Mês inválido." };
  }

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true, name: true, isActive: true },
  });

  if (!unit || !unit.isActive) {
    return { success: false, error: "Unidade não encontrada." };
  }

  const metric = await prisma.unitMonthlyMetric.findUnique({
    where: { unitId_year_month: { unitId, year, month } },
    select: {
      goalAmount: true,
      resultAmount: true,
      goalLiters: true,
      closedAt: true,
      commissionRuleSetId: true,
    },
  });

  const activeEmployees = await prisma.employee.findMany({
    where: { unitId, status: "ACTIVE" },
    select: { id: true, name: true, shift: true, employmentType: true },
    orderBy: { name: "asc" },
  });

  const recordSelect = {
    id: true,
    employeeId: true,
    employmentType: true,
    employeeShift: true,
    baseGoalLiters: true,
    finalGoalLiters: true,
    soldLiters: true,
    abastecimento: true,
    goalSource: true,
    periodStatus: true,
    soldStock: true,
    stockCommission: true,
    stockGoalCommission: true,
    baseStockGoal: true,
    effectiveStockGoal: true,
    dobras: true,
    stockMultiplier: true,
    litersMultiplier: true,
    baseCommission: true,
    bonusAmount: true,
    totalCommission: true,
    finalTotalCommission: true,
    commissionEligible: true,
    minimumEligibilityPercentage: true,
    ineligibilityReason: true,
    employee: { select: { name: true, status: true, unitId: true } },
  } satisfies Prisma.EmployeeMonthlyRecordSelect;

  const records = await prisma.employeeMonthlyRecord.findMany({
    where: { unitId, year, month },
    select: recordSelect,
  });

  const EMPLOYMENT_TYPE_MAP: Record<string, "efetivado" | "experiencia"> = {
    PERMANENT: "efetivado",
    PROBATION: "experiencia",
  };

  const SHIFT_MAP: Record<string, "diurno" | "noturno"> = {
    DAYTIME: "diurno",
    NIGHTTIME: "noturno",
  };

  const GOAL_SOURCE_MAP: Record<string, "automatico" | "manual"> = {
    AUTOMATIC: "automatico",
    MANUAL: "manual",
  };

  const isClosed = metric?.closedAt != null;
  if (metric?.closedAt && !metric.commissionRuleSetId) {
    return { success: false, error: "Fechamento histórico sem versão de regras vinculada; os snapshots não serão reconstruídos com a regra atual." };
  }
  const resolvedRules = metric?.commissionRuleSetId
    ? await getCommissionRulesById(metric.commissionRuleSetId)
    : await getCommissionRulesForPeriod({ year, month });
  const officialRecords = isClosed
    ? records.filter((record) => record.finalTotalCommission !== null)
    : records.filter((record) => record.employee.status === "ACTIVE" && record.employee.unitId === unitId);
  const recordsByEmployee = new Map(officialRecords.map((record) => [record.employeeId, record]));
  const preserveHistoricalSnapshot = isClosed;
  const employeesForDisplay = preserveHistoricalSnapshot
    ? officialRecords.map((record) => ({
        id: record.employeeId,
        name: record.employee.name,
        shift: record.employeeShift,
        employmentType: record.employmentType,
      })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    : activeEmployees;

  const employees: EmployeeRecordRow[] = employeesForDisplay.map((emp) => {
    const record = recordsByEmployee.get(emp.id);

    if (record) {
      const employmentType = preserveHistoricalSnapshot ? record.employmentType : emp.employmentType;
      const employeeShift = preserveHistoricalSnapshot ? record.employeeShift : emp.shift;
      const snapshot = resolveGoalDisplaySnapshot({
        employmentType,
        rules: resolvedRules.rules,
        closed: isClosed,
        baseGoalLiters: Number(record.baseGoalLiters),
        effectiveGoalLiters: Number(record.finalGoalLiters),
        soldLiters: Number(record.soldLiters),
        baseStockGoal: record.baseStockGoal == null ? null : Number(record.baseStockGoal),
        effectiveStockGoal: record.effectiveStockGoal == null ? null : Number(record.effectiveStockGoal),
        legacyStockGoal: record.stockGoalCommission == null ? null : Number(record.stockGoalCommission),
        soldStock: record.soldStock == null ? null : Number(record.soldStock),
      });

      return {
        employeeId: emp.id,
        name: emp.name,
        employmentType: EMPLOYMENT_TYPE_MAP[employmentType] ?? "efetivado",
        employeeShift: SHIFT_MAP[employeeShift] ?? "diurno",
        finalGoalLiters: snapshot.effectiveGoalLiters,
        baseGoalLiters: snapshot.baseGoalLiters,
        achievementPercentage: snapshot.achievementPercentage,
        litersZone: snapshot.litersZone,
        soldLiters: Number(record.soldLiters),
        abastecimento: record.abastecimento,
        goalSource: GOAL_SOURCE_MAP[record.goalSource] ?? "automatico",
        periodStatus: record.periodStatus ?? "ACTIVE",
        soldStock: record.soldStock !== null ? Number(record.soldStock) : null,
        stockCommission: record.stockCommission !== null ? Number(record.stockCommission) : null,
        stockGoalCommission: snapshot.effectiveStockGoal || null,
        baseStockGoal: snapshot.baseStockGoal || null,
        stockAchievementPercentage: snapshot.stockAchievementPercentage,
        stockZone: snapshot.stockZone,
        dobras: record.dobras !== null ? Number(record.dobras) : null,
        stockMultiplier: record.stockMultiplier !== null ? Number(record.stockMultiplier) : null,
        litersMultiplier: record.litersMultiplier !== null ? Number(record.litersMultiplier) : null,
        baseCommission: record.baseCommission !== null ? Number(record.baseCommission) : null,
        bonusAmount: record.bonusAmount !== null ? Number(record.bonusAmount) : null,
        totalCommission: record.totalCommission !== null ? Number(record.totalCommission) : null,
        finalTotalCommission:
          record.finalTotalCommission !== null || record.totalCommission !== null
            ? getOfficialCommissionValue(record)
            : null,
        commissionEligible: record.commissionEligible,
        minimumEligibilityPercentage: record.minimumEligibilityPercentage !== null ? Number(record.minimumEligibilityPercentage) : null,
        ineligibilityReason: record.ineligibilityReason,
        hasRecord: true,
      };
    }

    return {
      employeeId: emp.id,
      name: emp.name,
      employmentType: EMPLOYMENT_TYPE_MAP[emp.employmentType] ?? "efetivado",
      employeeShift: SHIFT_MAP[emp.shift] ?? "diurno",
      finalGoalLiters: 0,
      baseGoalLiters: 0,
      achievementPercentage: 0,
      litersZone: "NEUTRAL" as const,
      soldLiters: 0,
      abastecimento: 0,
      goalSource: "automatico" as const,
      periodStatus: "ACTIVE" as const,
      soldStock: null,
      stockCommission: null,
      stockGoalCommission: null,
      baseStockGoal: null,
      stockAchievementPercentage: 0,
      stockZone: "NEUTRAL" as const,
      dobras: null,
      stockMultiplier: null,
      litersMultiplier: null,
      baseCommission: null,
      bonusAmount: null,
      totalCommission: null,
      finalTotalCommission: null,
      commissionEligible: null,
      minimumEligibilityPercentage: null,
      ineligibilityReason: null,
      hasRecord: false,
    };
  });

  const commissionTotal = officialRecords.reduce(
    (sum, r) =>
      sum +
      getOfficialCommissionValue(r),
    0,
  );
  return {
    success: true,
    data: {
      unitId: unit.id,
      unitName: unit.name,
      year,
      month,
      goalAmount: metric ? Number(metric.goalAmount) : 0,
      resultAmount: metric ? Number(metric.resultAmount) : 0,
      goalLiters: metric?.goalLiters !== null && metric?.goalLiters !== undefined ? Number(metric.goalLiters) : 0,
      commissionTotal,
      closedAt: metric?.closedAt ? metric.closedAt.toISOString() : null,
      commissionRules: resolvedRules.rules,
      employees,
    },
  };
}

// ── upsert ──────────────────────────────────────────────────────────

type UpsertEmployeeRecordInput = {
  employeeId: string;
  unitId: string;
  year: number;
  month: number;
  soldLiters: number;
  abastecimento?: number;
  baseGoalLiters: number;
  goalSource: "AUTOMATIC" | "MANUAL";
  periodStatus?: "ACTIVE" | "VACATION" | "ABSENCE" | "MEDICAL_LEAVE";
  soldStock?: number | null;
  stockCommission?: number | null;
  stockGoalCommission?: number | null;
  dobras?: number | null;
};

const VALID_GOAL_SOURCES = ["AUTOMATIC", "MANUAL"] as const;
const VALID_PERIOD_STATUSES = ["ACTIVE", "VACATION", "ABSENCE", "MEDICAL_LEAVE"] as const;

export async function upsertEmployeeMonthlyRecord(
  input: UpsertEmployeeRecordInput,
): Promise<ActionResult> {
  if (!input.employeeId || !input.employeeId.trim()) {
    return { success: false, error: "ID do funcionário é obrigatório." };
  }

  if (!input.unitId || !input.unitId.trim()) {
    return { success: false, error: "ID da unidade é obrigatório." };
  }

  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    return { success: false, error: "Ano inválido." };
  }

  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    return { success: false, error: "Mês inválido." };
  }

  if (typeof input.soldLiters !== "number" || input.soldLiters < 0) {
    return { success: false, error: "Litros vendidos não pode ser negativo." };
  }

  if (
    input.abastecimento != null &&
    (!Number.isFinite(input.abastecimento) || input.abastecimento < 0 || !Number.isInteger(input.abastecimento))
  ) {
    return { success: false, error: "Abastecimento deve ser um número inteiro não negativo." };
  }

  if (typeof input.baseGoalLiters !== "number" || input.baseGoalLiters < 0) {
    return { success: false, error: "Meta base em litros não pode ser negativa." };
  }

  if (!VALID_GOAL_SOURCES.includes(input.goalSource)) {
    return { success: false, error: "Fonte da meta inválida." };
  }

  if (input.periodStatus != null && !VALID_PERIOD_STATUSES.includes(input.periodStatus)) {
    return { success: false, error: "Status inválido." };
  }

  if (input.dobras != null && (!Number.isFinite(input.dobras) || input.dobras < 0)) {
    return { success: false, error: "Dobras não pode ser negativo." };
  }

  // guard: período fechado
  const metric = await prisma.unitMonthlyMetric.findUnique({
    where: { unitId_year_month: { unitId: input.unitId, year: input.year, month: input.month } },
    select: { closedAt: true, commissionRuleSetId: true },
  });

  if (!metric) {
    return { success: false, error: "Meta mensal não configurada para este período. Configure antes de lançar registros." };
  }

  if (metric.closedAt) {
    return { success: false, error: "Período fechado. Reabra antes de editar." };
  }

  // snapshot do cadastro atual do funcionário
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { shift: true, employmentType: true, unitId: true, status: true },
  });

  if (!employee) {
    return { success: false, error: "Funcionário não encontrado." };
  }

  if (employee.unitId !== input.unitId) {
    return { success: false, error: "Funcionário não pertence a esta unidade." };
  }

  if (employee.status !== "ACTIVE") {
    return { success: false, error: "Funcionário inativo não participa de competência operacional." };
  }

  const historicalRecord = metric.commissionRuleSetId ? await prisma.employeeMonthlyRecord.findUnique({
    where: { employeeId_year_month: { employeeId: input.employeeId, year: input.year, month: input.month } },
    select: { employmentType: true, employeeShift: true },
  }) : null;
  const employmentType = historicalRecord?.employmentType ?? employee.employmentType;
  const employeeShift = historicalRecord?.employeeShift ?? employee.shift;

  // Calcula multiplicador de estoque automaticamente
  const resolvedRules = metric.commissionRuleSetId
    ? await getCommissionRulesById(metric.commissionRuleSetId)
    : await getCommissionRulesForPeriod({ year: input.year, month: input.month });
  const effectiveGoalLiters = employmentType === "PROBATION"
    ? Math.round(input.baseGoalLiters * resolvedRules.rules.probationGoalFactor * 1000) / 1000
    : input.baseGoalLiters;
  const effectiveStockGoal = input.stockGoalCommission == null ? null
    : employmentType === "PROBATION"
      ? Math.round(input.stockGoalCommission * resolvedRules.rules.probationGoalFactor * 100) / 100
      : input.stockGoalCommission;
  const stockResult = calculateStockCommission({
    vendaEstoque: input.soldStock,
    metaEstoque: effectiveStockGoal,
    comissaoEstoqueBase: input.stockCommission ?? 0,
  }, resolvedRules.rules);
  const computedStockMultiplier = stockResult.multiplicadorEstoque;

  try {
    await prisma.employeeMonthlyRecord.upsert({
      where: {
        employeeId_year_month: {
          employeeId: input.employeeId,
          year: input.year,
          month: input.month,
        },
      },
      create: {
        employeeId: input.employeeId,
        unitId: input.unitId,
        year: input.year,
        month: input.month,
        employmentType,
        employeeShift,
        baseGoalLiters: input.baseGoalLiters,
        finalGoalLiters: effectiveGoalLiters,
        goalSource: input.goalSource,
        periodStatus: input.periodStatus ?? "ACTIVE",
        soldLiters: input.soldLiters,
        abastecimento: input.abastecimento ?? 0,
        soldStock: input.soldStock ?? null,
        stockCommission: input.stockCommission ?? null,
        stockGoalCommission: input.stockGoalCommission ?? null,
        baseStockGoal: input.stockGoalCommission ?? null,
        effectiveStockGoal,
        dobras: input.dobras ?? null,
        stockMultiplier: computedStockMultiplier,
      },
      update: {
        employmentType,
        employeeShift,
        soldLiters: input.soldLiters,
        abastecimento: input.abastecimento ?? undefined,
        baseGoalLiters: input.baseGoalLiters,
        finalGoalLiters: effectiveGoalLiters,
        goalSource: input.goalSource,
        periodStatus: input.periodStatus ?? "ACTIVE",
        soldStock: input.soldStock === undefined ? undefined : input.soldStock,
        stockCommission: input.stockCommission === undefined ? undefined : input.stockCommission,
        stockGoalCommission: input.stockGoalCommission === undefined ? undefined : input.stockGoalCommission,
        baseStockGoal: input.stockGoalCommission === undefined ? undefined : input.stockGoalCommission,
        effectiveStockGoal: input.stockGoalCommission === undefined ? undefined : effectiveStockGoal,
        dobras: input.dobras === undefined ? undefined : input.dobras,
        stockMultiplier: computedStockMultiplier,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { success: false, error: "Funcionário ou unidade não encontrada." };
    }

    throw error;
  }

  revalidatePath("/", "layout");
  return { success: true };
}

// ── batch upsert ───────────────────────────────────────────────────

export async function batchUpsertEmployeeMonthlyRecords(
  inputs: UpsertEmployeeRecordInput[],
): Promise<ActionResult> {
  if (inputs.length === 0) {
    return { success: false, error: "Nenhum registro para salvar." };
  }

  for (const input of inputs) {
    const result = await upsertEmployeeMonthlyRecord(input);
    if (!result.success) return result;
  }

  return { success: true };
}
