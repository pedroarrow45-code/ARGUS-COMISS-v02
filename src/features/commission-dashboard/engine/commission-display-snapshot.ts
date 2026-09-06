import { getZoneFromPercentage, type CommissionRules, type CommissionZone } from "./calculate-commission";
import type { EmploymentType } from "./types";

type NullableNumber = number | null | undefined;

export type GoalDisplaySnapshot = {
  baseGoalLiters: number;
  effectiveGoalLiters: number;
  achievementPercentage: number;
  litersZone: CommissionZone;
  baseStockGoal: number;
  effectiveStockGoal: number;
  stockAchievementPercentage: number;
  stockZone: CommissionZone;
};

const positive = (value: NullableNumber) => value != null && value > 0 ? value : 0;
const round = (value: number, scale: number) => Math.round(value * 10 ** scale) / 10 ** scale;

/** Resolve somente snapshots do próprio registro; nunca herda meta de outro mês. */
export function resolveGoalDisplaySnapshot(input: {
  employmentType: EmploymentType;
  rules: CommissionRules;
  closed: boolean;
  baseGoalLiters: NullableNumber;
  effectiveGoalLiters: NullableNumber;
  soldLiters: number;
  baseStockGoal: NullableNumber;
  effectiveStockGoal: NullableNumber;
  legacyStockGoal: NullableNumber;
  soldStock: NullableNumber;
}): GoalDisplaySnapshot {
  const factor = input.employmentType === "PROBATION" ? input.rules.probationGoalFactor : 1;
  const storedBaseLiters = positive(input.baseGoalLiters);
  // A base cadastrada e soberana. Snapshots legados sem base sao exibidos como
  // corrompidos (zero), nunca "reconstruidos" por divisao e contaminados no save.
  const baseGoalLiters = storedBaseLiters;
  const effectiveGoalLiters = baseGoalLiters ? round(baseGoalLiters * factor, 3) : 0;

  const storedBaseStock = positive(input.baseStockGoal) || positive(input.legacyStockGoal);
  const baseStockGoal = storedBaseStock;
  const effectiveStockGoal = baseStockGoal ? round(baseStockGoal * factor, 2) : 0;

  const achievementPercentage = effectiveGoalLiters > 0 ? input.soldLiters / effectiveGoalLiters * 100 : 0;
  const stockAchievementPercentage = effectiveStockGoal > 0 ? positive(input.soldStock) / effectiveStockGoal * 100 : 0;
  return {
    baseGoalLiters,
    effectiveGoalLiters,
    achievementPercentage,
    litersZone: getZoneFromPercentage(achievementPercentage, input.rules).zone,
    baseStockGoal,
    effectiveStockGoal,
    stockAchievementPercentage,
    stockZone: getZoneFromPercentage(stockAchievementPercentage, input.rules).zone,
  };
}
