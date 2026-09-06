export type CompanyType = "ARGUS INTEL" | "ARGUS SYSTEMS";
export type ProjectStatus = "Planejamento" | "Em andamento" | "Concluído";

export type Project = {
  id: string;
  name: string;
  company: CompanyType;
  owner: string;
  status: ProjectStatus;
  progress: number;
  targetValue: number;
  currentValue: number;
  dueDate: string;
};

export type ProjectInput = Omit<Project, "id">;
