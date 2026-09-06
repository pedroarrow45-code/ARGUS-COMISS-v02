export type UnitsPeriodInput = {
  year: number;
  month: number;
};

export type UnitsRow = {
  id: string;
  name: string;
  goal: number;
  result: number;
  employeesCount: number;
  totalCommission: number;
};

export type UnitsOverview = {
  period: UnitsPeriodInput;
  units: UnitsRow[];
};
