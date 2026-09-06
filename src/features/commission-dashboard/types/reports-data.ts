export type EmployeePeriodStatus = "ACTIVE" | "VACATION" | "ABSENCE" | "MEDICAL_LEAVE";

export type ReportsPeriodInput = {
  year: number;
  month: number;
};

export type ReportsUnit = {
  id: string;
  name: string;
  goal: number;
  result: number;
  goalLiters: number;
  goalStock: number;
  resultLiters: number;
  resultStock: number;
  totalCommission: number;
  status: "ativa";
};

export type ReportsEmployee = {
  id: string;
  name: string;
  unitId: string;
  employeeShift: "DAYTIME" | "NIGHTTIME";
  status: "ativo" | "inativo";
  periodStatus: EmployeePeriodStatus;
  calculationStatus: "PREVIEW" | "CLOSED";
  commissionEligible: boolean;
  minimumEligibilityPercentage: number;
  ineligibilityReason: string | null;
  soldLiters: number;
  abastecimento: number;
  soldStock: number;
  baseGoalLiters: number;
  finalGoalLiters: number;
  baseRate: number;
  baseCommission: number;
  stockCommission: number;
  dobras: number;
  rankingCommission: number;
  litersMultiplier: number;
  stockMultiplier: number;
  correctedLiters: number;
  correctedStock: number;
  metLitragem: boolean;
  metEstoque: boolean;
  bonusApplied: boolean;
  bonusAmount: number;
  totalCommission: number;
  finalTotalCommission: number;
  completionPercent: number;
  experienceStatus: "experiencia" | "efetivado";
};

export type ReportsOverview = {
  period: ReportsPeriodInput;
  units: ReportsUnit[];
  employees: ReportsEmployee[];
};
