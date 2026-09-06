import type { CompanyType } from "./project";

export type DashboardMetric = {
  label: string;
  value: string;
  helper: string;
};

export type CompanySummary = {
  company: CompanyType;
  projects: number;
  targetValue: number;
  currentValue: number;
  progress: number;
};
