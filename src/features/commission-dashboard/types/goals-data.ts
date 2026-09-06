export type GoalsPeriodInput = {
  year: number;
  month: number;
};

export type GoalsUnitRow = {
  unitId: string;
  unitName: string;
  goalAmount: number;
  resultAmount: number;
  goalLiters: number;
  goalStock: number;
  resultLiters: number;
  resultStock: number;
  activeEmployeesCount: number;
  totalCommission: number;
  totalBaseCommission: number;
  totalBonusAmount: number;
  bonusApplied: boolean;
  closedAt: string | null;
};

export type GoalsOverview = {
  period: GoalsPeriodInput;
  units: GoalsUnitRow[];
};
