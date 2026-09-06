import { prisma } from "@/lib/prisma";

import { calculateCommission, roundCommission } from "../engine/calculate-commission";
import { resolveGoalDisplaySnapshot } from "../engine/commission-display-snapshot";
import type { ReportsOverview, ReportsPeriodInput } from "../types/reports-data";
import { getOfficialCommissionValue } from "./official-commission";
import { getCommissionRulesById, getCommissionRulesForPeriod } from "../rules/get-commission-rules";

type DecimalLike = { toNumber(): number };

function toNumber(value: DecimalLike | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function calculateCompletionPercent(soldLiters: number, goalLiters: number) {
  return goalLiters > 0 ? Number(((soldLiters / goalLiters) * 100).toFixed(1)) : 0;
}

function getExperienceStatus(employmentType: "PERMANENT" | "PROBATION"): "experiencia" | "efetivado" {
  return employmentType === "PERMANENT" ? "efetivado" : "experiencia";
}

export async function getReportsOverview(period: ReportsPeriodInput): Promise<ReportsOverview> {
  const units = await prisma.unit.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      monthlyMetrics: {
        where: { year: period.year, month: period.month },
        select: {
          goalAmount: true,
          resultAmount: true,
          goalLiters: true,
          goalStock: true,
          resultLiters: true,
          resultStock: true,
          closedAt: true,
          commissionRuleSetId: true,
        },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  const employeeRecords = await prisma.employeeMonthlyRecord.findMany({
    where: {
      year: period.year,
      month: period.month,
      unit: { isActive: true },
    },
    select: {
      employeeId: true,
      unitId: true,
      employmentType: true,
      employeeShift: true,
      periodStatus: true,
      soldLiters: true,
      abastecimento: true,
      soldStock: true,
      baseGoalLiters: true,
      finalGoalLiters: true,
      baseRate: true,
      baseCommission: true,
      stockCommission: true,
      dobras: true,
      litersMultiplier: true,
      stockMultiplier: true,
      bonusApplied: true,
      bonusAmount: true,
      totalCommission: true,
      finalTotalCommission: true,
      commissionEligible: true,
      minimumEligibilityPercentage: true,
      ineligibilityReason: true,
      stockGoalCommission: true,
      baseStockGoal: true,
      effectiveStockGoal: true,
      employee: { select: { name: true, status: true, unitId: true } },
    },
  });

  const unitContext = new Map(
    units.map((unit) => {
      const metric = unit.monthlyMetrics[0];
      const soldLiters = employeeRecords
        .filter((record) => record.unitId === unit.id)
        .filter((record) => metric?.closedAt != null || (
          record.employee.status === "ACTIVE" && record.employee.unitId === unit.id
        ))
        .reduce((sum, record) => sum + toNumber(record.soldLiters), 0);
      const goalLiters = toNumber(metric?.goalLiters);
      return [unit.id, { closed: metric?.closedAt != null, commissionRuleSetId: metric?.commissionRuleSetId ?? null, unitMetLitersGoal: goalLiters > 0 && soldLiters >= goalLiters }] as const;
    }),
  );
  const hasOpenUnit = [...unitContext.values()].some((context) => !context.closed);
  const previewRules = hasOpenUnit ? await getCommissionRulesForPeriod(period) : null;
  const closedRuleIds = [...new Set([...unitContext.values()].flatMap((context) => context.closed && context.commissionRuleSetId ? [context.commissionRuleSetId] : []))];
  const closedRules = new Map(await Promise.all(closedRuleIds.map(async (id) => [id, await getCommissionRulesById(id)] as const)));

  const employees = employeeRecords
    .filter((record) => {
      const context = unitContext.get(record.unitId);

      if (!context) return false;

      // O fechamento define exclusivamente se a população é histórica. Em uma
      // competência aberta (inclusive reaberta), o cadastro atual é a fonte de
      // verdade e o vínculo Employee/EmployeeMonthlyRecord deve ser consistente.
      if (!context.closed) {
        return record.employee.status === "ACTIVE" && record.employee.unitId === record.unitId;
      }

      // Fechamentos preservam a população materializada, ainda que o funcionário
      // tenha sido inativado ou transferido posteriormente. NULL distingue um
      // snapshot stale de um participante processado que legitimamente recebeu 0.
      return record.finalTotalCommission != null;
    })
    .map((record) => {
      const context = unitContext.get(record.unitId) ?? { closed: false, commissionRuleSetId: null, unitMetLitersGoal: false };
      const soldLiters = toNumber(record.soldLiters);
      const finalGoalLiters = toNumber(record.finalGoalLiters);
      const soldStock = record.soldStock == null ? null : toNumber(record.soldStock);
      const stockGoal = record.baseStockGoal != null
        ? toNumber(record.baseStockGoal)
        : record.stockGoalCommission == null ? null : toNumber(record.stockGoalCommission);
      const stockBaseCommission = toNumber(record.stockCommission);
      const dobras = toNumber(record.dobras);
      const preview = context.closed
        ? null
        : calculateCommission({
            employmentType: record.employmentType,
            employeeShift: record.employeeShift,
            baseGoalLiters: toNumber(record.baseGoalLiters),
            soldLiters,
            unitMetLitersGoal: context.unitMetLitersGoal,
            soldStock,
            stockGoal,
            stockBaseCommission,
            dobras,
          }, previewRules!.rules);
      const historicalRules = context.commissionRuleSetId ? closedRules.get(context.commissionRuleSetId) : null;
      const displaySnapshot = historicalRules ? resolveGoalDisplaySnapshot({
        employmentType: record.employmentType,
        rules: historicalRules.rules,
        closed: true,
        baseGoalLiters: toNumber(record.baseGoalLiters),
        effectiveGoalLiters: finalGoalLiters,
        soldLiters,
        baseStockGoal: record.baseStockGoal == null ? null : toNumber(record.baseStockGoal),
        effectiveStockGoal: record.effectiveStockGoal == null ? null : toNumber(record.effectiveStockGoal),
        legacyStockGoal: record.stockGoalCommission == null ? null : toNumber(record.stockGoalCommission),
        soldStock,
      }) : null;
      const applicableGoalLiters = preview?.effectiveGoalLiters ?? displaySnapshot?.effectiveGoalLiters ?? finalGoalLiters;
      const applicableStockGoal = preview?.effectiveStockGoal ?? displaySnapshot?.effectiveStockGoal
        ?? (record.effectiveStockGoal == null ? stockGoal : toNumber(record.effectiveStockGoal));

      // Fechado: os outputs persistidos são imutáveis para leitura. O fallback para
      // totalCommission atende somente registros históricos sem finalTotalCommission.
      const baseRate = preview?.baseRate ?? toNumber(record.baseRate);
      const baseCommission = preview?.baseCommission ?? toNumber(record.baseCommission);
      const litersMultiplier = preview?.litersMultiplier ?? (toNumber(record.litersMultiplier) || 1);
      const stockMultiplier = preview?.stockMultiplier ?? (toNumber(record.stockMultiplier) || 1);
      const bonusApplied = preview?.bonusApplied ?? record.bonusApplied;
      const bonusAmount = preview?.bonusAmount ?? toNumber(record.bonusAmount);
      const totalCommission = preview?.totalCommission ?? toNumber(record.totalCommission);
      const finalTotalCommission = preview?.finalTotalCommission ?? getOfficialCommissionValue(record);
      const commissionEligible = preview?.eligible ?? record.commissionEligible ?? true;
      const effectiveDobras = preview?.dobras ?? (commissionEligible ? dobras : 0);
      const correctedLiters = totalCommission;
      const correctedStock = preview?.stockFinalCommission
        ?? roundCommission(finalTotalCommission - totalCommission - effectiveDobras);
      const completionPercent = preview?.achievementPercentage ?? calculateCompletionPercent(soldLiters, applicableGoalLiters);
      const minimumEligibilityPercentage = preview?.minimumEligibilityPercentage ?? toNumber(record.minimumEligibilityPercentage);
      const ineligibilityReason = preview?.ineligibilityReason ?? record.ineligibilityReason;

      return {
        id: record.employeeId,
        name: record.employee.name,
        unitId: record.unitId,
        employeeShift: record.employeeShift,
        employmentType: record.employmentType,
        status: record.employee.status === "ACTIVE" ? ("ativo" as const) : ("inativo" as const),
        periodStatus: record.periodStatus ?? "ACTIVE",
        calculationStatus: context.closed ? ("CLOSED" as const) : ("PREVIEW" as const),
        commissionEligible, minimumEligibilityPercentage, ineligibilityReason,
        soldLiters,
        abastecimento: record.abastecimento,
        soldStock: toNumber(record.soldStock),
        baseGoalLiters: toNumber(record.baseGoalLiters),
        finalGoalLiters: applicableGoalLiters,
        stockGoalCommission: applicableStockGoal ?? undefined,
        baseRate,
        baseCommission,
        stockCommission: stockBaseCommission,
        dobras: effectiveDobras,
        rankingCommission: finalTotalCommission,
        litersMultiplier,
        stockMultiplier,
        correctedLiters,
        correctedStock,
        metLitragem: preview?.litersCommissionEligible ?? baseCommission > 0,
        metEstoque: preview?.stockCommissionEligible ?? correctedStock > 0,
        bonusApplied,
        bonusAmount,
        totalCommission,
        finalTotalCommission,
        completionPercent,
        experienceStatus: getExperienceStatus(record.employmentType),
      };
    })
    .sort((current, next) => current.name.localeCompare(next.name, "pt-BR"));

  const commissionTotalByUnit = employees.reduce<Map<string, number>>((map, employee) => {
    map.set(employee.unitId, (map.get(employee.unitId) ?? 0) + employee.finalTotalCommission);
    return map;
  }, new Map());

  return {
    period,
    units: units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      goal: toNumber(unit.monthlyMetrics[0]?.goalAmount),
      result: toNumber(unit.monthlyMetrics[0]?.resultAmount),
      goalLiters: toNumber(unit.monthlyMetrics[0]?.goalLiters),
      goalStock: toNumber(unit.monthlyMetrics[0]?.goalStock),
      resultLiters: toNumber(unit.monthlyMetrics[0]?.resultLiters),
      resultStock: toNumber(unit.monthlyMetrics[0]?.resultStock),
      totalCommission: roundCommission(commissionTotalByUnit.get(unit.id) ?? 0),
      status: "ativa" as const,
    })),
    employees,
  };
}
