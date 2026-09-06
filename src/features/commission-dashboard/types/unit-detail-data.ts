import type { CommissionRules } from "../engine/calculate-commission";

export type EmployeePeriodStatus = "ACTIVE" | "VACATION" | "ABSENCE" | "MEDICAL_LEAVE";

export type EmployeeRecordRow = {
  employeeId: string;
  name: string;
  employmentType: "efetivado" | "experiencia";
  employeeShift: "diurno" | "noturno";
  finalGoalLiters: number;
  baseGoalLiters: number;
  achievementPercentage: number;
  litersZone: "NEUTRAL" | "GREEN" | "BLUE";
  soldLiters: number;
  abastecimento: number;
  goalSource: "automatico" | "manual";
  periodStatus: EmployeePeriodStatus;
  soldStock: number | null;
  stockCommission: number | null;
  stockGoalCommission: number | null;
  baseStockGoal: number | null;
  stockAchievementPercentage: number;
  stockZone: "NEUTRAL" | "GREEN" | "BLUE";
  dobras: number | null;
  stockMultiplier: number | null;
  litersMultiplier: number | null;
  baseCommission: number | null;
  bonusAmount: number | null;
  totalCommission: number | null;
  finalTotalCommission: number | null;
  commissionEligible: boolean | null;
  minimumEligibilityPercentage: number | null;
  ineligibilityReason: string | null;
  hasRecord: boolean;
};

export type UnitMonthlyDetail = {
  unitId: string;
  unitName: string;
  year: number;
  month: number;
  goalAmount: number;
  resultAmount: number;
  goalLiters: number;
  commissionTotal: number;
  closedAt: string | null;
  commissionRules: CommissionRules;
  employees: EmployeeRecordRow[];
};
