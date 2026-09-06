export type EmployeesPeriodInput = {
  year: number;
  month: number;
};

export type EmployeesUnit = {
  id: string;
  name: string;
  goal: number;
  result: number;
};

export type EmployeesRow = {
  id: string;
  name: string;
  unitId: string;
  status: "ativo" | "inativo";
  shift: "diurno" | "noturno";
  employmentType: "efetivado" | "experiencia";
  totalCommission: number | null;
};

export type EmployeesOverview = {
  period: EmployeesPeriodInput;
  employees: EmployeesRow[];
  units: EmployeesUnit[];
};
