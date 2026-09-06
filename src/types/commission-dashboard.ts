export type TabId = "dashboard" | "unidades" | "funcionarios" | "metas" | "relatorios" | "configuracoes";

export type Unit = {
  id: number | string;
  name: string;
  goal: number;
  result: number;
  goalLiters?: number;
  goalStock?: number;
  resultLiters?: number;
  resultStock?: number;
  totalCommission?: number;
  status: "ativa" | "inativa";
};

export type EmployeeStatus = "ativo" | "inativo";
export type EmployeePeriodStatus = "ACTIVE" | "VACATION" | "ABSENCE" | "MEDICAL_LEAVE";

export type Employee = {
  id: number | string;
  name: string;
  unitId: number | string;
  employeeShift?: "DAYTIME" | "NIGHTTIME";
  employmentType?: "PERMANENT" | "PROBATION";
  status: EmployeeStatus;
  periodStatus?: EmployeePeriodStatus;
  calculationStatus?: "PREVIEW" | "CLOSED";
  soldLiters?: number;
  abastecimento?: number;
  soldStock?: number;
  baseGoalLiters?: number;
  finalGoalLiters?: number;
  baseRate?: number;
  stockGoalCommission?: number;
  baseCommission?: number;
  stockCommission?: number;
  dobras?: number;
  rankingCommission?: number;
  litersMultiplier?: number;
  stockMultiplier?: number;
  correctedLiters?: number;
  correctedStock?: number;
  metLitragem?: boolean;
  metEstoque?: boolean;
  bonusApplied?: boolean;
  bonusAmount?: number;
  totalCommission?: number;
  finalTotalCommission?: number;
  completionPercent?: number;
  experienceStatus?: "experiencia" | "efetivado";
};

export type HistoricalPoint = {
  month: string;
  goal: number;
  result: number;
};

export type IconName =
  | "dashboard"
  | "units"
  | "users"
  | "goals"
  | "reports"
  | "settings"
  | "plus"
  | "edit"
  | "trash"
  | "search"
  | "fuel"
  | "download"
  | "close"
  | "check"
  | "info"
  | "alert"
  | "pdf"
  | "table";

export type NavItem = {
  id: TabId;
  label: string;
  icon: IconName;
};
