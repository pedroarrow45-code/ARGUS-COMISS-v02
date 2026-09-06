import { calculateCommission } from "./calculate-commission";
import type { CommissionRules } from "./calculate-commission";
import type { EmployeeCommissionResult, UnitCommissionResult, UnitMonthInput } from "./types";

/**
 * Adaptador de cálculo coletivo preservado para os consumidores existentes.
 * As decisões financeiras por funcionário pertencem ao motor calculateCommission.
 */
export function calculateUnitCommissions(input: UnitMonthInput, rules: CommissionRules): UnitCommissionResult {
  const unitMetGoal = input.unitGoalLiters > 0 && input.unitSoldLiters >= input.unitGoalLiters;
  const bonusUnlocked = unitMetGoal;

  const employees: EmployeeCommissionResult[] = input.employees.map((employee) => {
    const calculation = calculateCommission({
      employmentType: employee.employmentType,
      employeeShift: employee.shift,
      baseGoalLiters: employee.baseGoalLiters,
      soldLiters: employee.soldLiters,
      unitMetLitersGoal: unitMetGoal,
      soldStock: null,
      stockGoal: null,
      stockBaseCommission: 0,
      dobras: 0,
    }, rules);

    return {
      employeeId: employee.employeeId,
      completionPercent: calculation.achievementPercentage,
      metIndividualGoal: calculation.metIndividualGoal,
      eligible: calculation.eligible,
      minimumEligibilityPercentage: calculation.minimumEligibilityPercentage,
      ineligibilityReason: calculation.ineligibilityReason,
      baseRate: calculation.baseRate,
      baseCommission: calculation.baseCommission,
      litersMultiplier: calculation.litersMultiplier,
      bonusApplied: calculation.bonusApplied,
      bonusAmount: calculation.bonusAmount,
      totalCommission: calculation.totalCommission,
    };
  });
  const allEligibleMetGoal = employees.length > 0 && employees.every((employee) => employee.metIndividualGoal);

  return { unitMetGoal, allEligibleMetGoal, bonusUnlocked, employees };
}
