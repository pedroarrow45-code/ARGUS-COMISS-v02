import type { EmployeeShift, EmploymentType } from "./types";

export type CommissionZone = "NEUTRAL" | "GREEN" | "BLUE";

export const INDIVIDUAL_GOAL_ELIGIBILITY_PERCENTAGE = 100;

export type CommissionRules = {
  rates: Record<EmployeeShift, Record<EmploymentType, number>>;
  probationGoalFactor: number;
  minimumEligibilityPercentage: number;
  teamBonusRate: number;
  zones: {
    greenMinimumPercentage: number;
    blueMinimumPercentage: number;
    neutralMultiplier: number;
    greenMultiplier: number;
    blueMultiplier: number;
  };
};

/** Bootstrap/test fixture mirroring persisted version 1; production resolves rules from the database. */
export const CURRENT_COMMISSION_RULES: CommissionRules = {
  rates: {
    DAYTIME: { PERMANENT: 0.01, PROBATION: 0.0075 },
    NIGHTTIME: { PERMANENT: 0.03, PROBATION: 0.02 },
  },
  probationGoalFactor: 0.7,
  minimumEligibilityPercentage: INDIVIDUAL_GOAL_ELIGIBILITY_PERCENTAGE,
  teamBonusRate: 0.05,
  zones: {
    greenMinimumPercentage: 105,
    blueMinimumPercentage: 135,
    neutralMultiplier: 1,
    greenMultiplier: 1.15,
    blueMultiplier: 1.25,
  },
} as const;

export type CommissionCalculationInput = {
  employmentType: EmploymentType;
  employeeShift: EmployeeShift;
  /** Meta normal, antes do fator de experiência. */
  baseGoalLiters: number;
  soldLiters: number;
  unitMetLitersGoal: boolean;
  soldStock: number | null | undefined;
  stockGoal: number | null | undefined;
  stockBaseCommission: number;
  dobras: number;
};

export type CommissionCalculationBreakdown = {
  baseRate: number;
  finalGoalLiters: number;
  effectiveGoalLiters: number;
  achievementPercentage: number;
  eligible: boolean;
  minimumEligibilityPercentage: number;
  ineligibilityReason: string | null;
  metIndividualGoal: boolean;
  hitLitersTarget: boolean;
  hitStockTarget: boolean;
  litersCommissionEligible: boolean;
  stockCommissionEligible: boolean;
  litersFactor: number;
  stockFactor: number;
  baseCommission: number;
  litersMultiplier: number;
  litersZone: CommissionZone;
  boostedLitersCommission: number;
  bonusApplied: boolean;
  bonusAmount: number;
  stockAchievement: number;
  effectiveStockGoal: number;
  stockMultiplier: number;
  stockZone: CommissionZone;
  stockFinalCommission: number;
  totalCommission: number;
  dobras: number;
  finalTotalCommission: number;
};

export type StockCommissionBreakdown = Pick<
  CommissionCalculationBreakdown,
  "stockAchievement" | "stockMultiplier" | "stockZone" | "stockFinalCommission"
>;

export function roundCommission(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundGoal(value: number, scale: number): number {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
}

export function evaluateCommissionEligibility(input: {
  soldLiters: number;
  effectiveGoalLiters: number;
  minimumEligibilityPercentage: number;
}) {
  const rawAchievementPercentage = input.effectiveGoalLiters > 0
    ? (input.soldLiters / input.effectiveGoalLiters) * 100
    : 0;
  // Compare o percentual bruto para não antecipar limites por arredondamento de exibição.
  const eligible = input.effectiveGoalLiters > 0
    && rawAchievementPercentage >= input.minimumEligibilityPercentage;
  return {
    eligible,
    rawAchievementPercentage,
    ineligibilityReason: eligible ? null : input.effectiveGoalLiters <= 0
      ? "Meta individual inválida ou não definida."
      : `Abaixo da meta mínima (${roundCommission(rawAchievementPercentage).toFixed(2)}% / mínimo ${input.minimumEligibilityPercentage.toFixed(2)}%).`,
  };
}

export function getZoneFromPercentage(percentage: number, rules: CommissionRules): { zone: CommissionZone; multiplier: number } {
  if (percentage >= rules.zones.blueMinimumPercentage) {
    return { zone: "BLUE", multiplier: rules.zones.blueMultiplier };
  }
  if (percentage >= rules.zones.greenMinimumPercentage) {
    return { zone: "GREEN", multiplier: rules.zones.greenMultiplier };
  }
  return { zone: "NEUTRAL", multiplier: rules.zones.neutralMultiplier };
}

export function getStockZoneFromAchievement(achievement: number, rules: CommissionRules) {
  return getZoneFromPercentage(achievement * 100, rules);
}

export function calculateStockBreakdown(input: {
  soldStock: number | null | undefined;
  stockGoal: number | null | undefined;
  stockBaseCommission: number;
}, rules: CommissionRules): StockCommissionBreakdown {
  if (input.stockGoal == null || input.stockGoal <= 0 || input.soldStock == null || input.soldStock <= 0) {
    return {
      stockAchievement: 0,
      stockMultiplier: rules.zones.neutralMultiplier,
      stockZone: "NEUTRAL",
      stockFinalCommission: roundCommission(input.stockBaseCommission),
    };
  }

  const rawStockAchievement = input.soldStock / input.stockGoal;
  const stockAchievement = roundCommission(rawStockAchievement);
  const { zone: stockZone, multiplier: stockMultiplier } = getStockZoneFromAchievement(rawStockAchievement, rules);

  return {
    stockAchievement,
    stockMultiplier,
    stockZone,
    stockFinalCommission: roundCommission(input.stockBaseCommission * stockMultiplier),
  };
}

export function calculateCommission(input: CommissionCalculationInput, rules: CommissionRules): CommissionCalculationBreakdown {
  const goalFactor = input.employmentType === "PROBATION" ? rules.probationGoalFactor : 1;
  const effectiveGoalLiters = roundGoal(input.baseGoalLiters * goalFactor, 3);
  const effectiveStockGoal = input.stockGoal == null ? 0 : roundGoal(input.stockGoal * goalFactor, 2);
  const rawAchievementPercentage =
    effectiveGoalLiters > 0 ? (input.soldLiters / effectiveGoalLiters) * 100 : 0;
  const achievementPercentage = roundCommission(rawAchievementPercentage);
  const baseRate = rules.rates[input.employeeShift][input.employmentType];
  const minimumEligibilityPercentage = INDIVIDUAL_GOAL_ELIGIBILITY_PERCENTAGE;
  const eligibility = evaluateCommissionEligibility({
    soldLiters: input.soldLiters,
    effectiveGoalLiters,
    minimumEligibilityPercentage,
  });
  const hitLitersTarget = effectiveGoalLiters > 0 && input.soldLiters >= effectiveGoalLiters;
  const litersCommissionEligible = eligibility.eligible;
  const rawStockAchievement = effectiveStockGoal > 0 && input.soldStock != null
    ? (input.soldStock / effectiveStockGoal) * 100
    : 0;
  const hitStockTarget = effectiveStockGoal > 0
    && input.soldStock != null && input.soldStock >= effectiveStockGoal;
  const stockCommissionEligible = effectiveStockGoal > 0
    && input.soldStock != null && rawStockAchievement >= minimumEligibilityPercentage;
  const litersFactor = litersCommissionEligible ? (stockCommissionEligible ? 1 : 0.8) : 0;
  const stockFactor = stockCommissionEligible ? (litersCommissionEligible ? 1 : 0.8) : 0;
  const eligible = litersCommissionEligible;
  const { zone: litersZone, multiplier: litersMultiplier } = getZoneFromPercentage(rawAchievementPercentage, rules);
  const baseCommission = litersCommissionEligible ? roundCommission(input.soldLiters * baseRate) : 0;
  const grossLitersCommission = roundCommission(baseCommission * litersMultiplier);
  const bonusApplied = litersCommissionEligible && input.unitMetLitersGoal;
  const grossBonusAmount = bonusApplied
    ? roundCommission(grossLitersCommission * rules.teamBonusRate)
    : 0;
  const grossTotalLitersCommission = roundCommission(grossLitersCommission + grossBonusAmount);
  // O fator cruzado incide uma única vez sobre a comissão completa da meta.
  const totalCommission = roundCommission(grossTotalLitersCommission * litersFactor);
  const boostedLitersCommission = roundCommission(grossLitersCommission * litersFactor);
  const bonusAmount = roundCommission(totalCommission - boostedLitersCommission);
  const grossStock = calculateStockBreakdown({
    soldStock: input.soldStock,
    stockGoal: effectiveStockGoal,
    stockBaseCommission: input.stockBaseCommission,
  }, rules);
  const stock = {
    ...grossStock,
    stockFinalCommission: roundCommission(grossStock.stockFinalCommission * stockFactor),
  };
  // Dobras seguem a elegibilidade histórica da litragem e não recebem novamente
  // o redutor cruzado; cada componente de meta é reduzido exatamente uma vez.
  const dobras = litersCommissionEligible ? input.dobras : 0;
  const finalTotalCommission = roundCommission(totalCommission + stock.stockFinalCommission + dobras);

  return {
    baseRate,
    finalGoalLiters: effectiveGoalLiters,
    effectiveGoalLiters,
    achievementPercentage,
    eligible,
    minimumEligibilityPercentage,
    ineligibilityReason: eligibility.ineligibilityReason,
    metIndividualGoal: hitLitersTarget,
    hitLitersTarget,
    hitStockTarget,
    litersCommissionEligible,
    stockCommissionEligible,
    litersFactor,
    stockFactor,
    baseCommission,
    litersMultiplier: litersCommissionEligible ? litersMultiplier : 0,
    litersZone,
    boostedLitersCommission,
    bonusApplied,
    bonusAmount,
    effectiveStockGoal,
    ...stock,
    totalCommission,
    dobras,
    finalTotalCommission,
  };
}
