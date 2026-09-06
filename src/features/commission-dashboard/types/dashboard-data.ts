export type DashboardPeriodInput = {
  year: number;
  month: number;
};

export type DashboardRankingItem = {
  unitId: string;
  unitName: string;
  goalAmount: number;
  resultAmount: number;
  goalLiters: number;
  resultLiters: number;
  completionPercent: number;
  totalCommission: number;
};

export type DashboardHistoryItem = {
  year: number;
  month: number;
  label: string;
  goalAmount: number;
  resultAmount: number;
  goalLiters: number;
  resultLiters: number;
};

export type DashboardOverview = {
  period: DashboardPeriodInput;
  totalGoalAmount: number;
  totalResultAmount: number;
  completionPercent: number;
  totalGoalLiters: number;
  totalResultLiters: number;
  completionPercentLiters: number;
  activeEmployeesCount: number;
  totalCommissionAmount: number;
  totalGoalStock: number;
  ranking: DashboardRankingItem[];
  history: DashboardHistoryItem[];
};
