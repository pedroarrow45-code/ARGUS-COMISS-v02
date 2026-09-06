export type EmploymentType = "PERMANENT" | "PROBATION";
export type EmployeeShift = "DAYTIME" | "NIGHTTIME";

export type EmployeeRecordInput = {
  employeeId: string;
  employmentType: EmploymentType;
  shift: EmployeeShift;
  baseGoalLiters: number;
  soldLiters: number;
};

export type UnitMonthInput = {
  unitGoalLiters: number;
  unitSoldLiters: number;
  employees: EmployeeRecordInput[];
};

export type EmployeeCommissionResult = {
  employeeId: string;
  completionPercent: number;
  metIndividualGoal: boolean;
  eligible: boolean;
  minimumEligibilityPercentage: number;
  ineligibilityReason: string | null;
  baseRate: number;
  baseCommission: number;
  litersMultiplier: number;
  bonusApplied: boolean;
  bonusAmount: number;
  totalCommission: number;
};

export type UnitCommissionResult = {
  unitMetGoal: boolean;
  allEligibleMetGoal: boolean;
  bonusUnlocked: boolean;
  employees: EmployeeCommissionResult[];
};
