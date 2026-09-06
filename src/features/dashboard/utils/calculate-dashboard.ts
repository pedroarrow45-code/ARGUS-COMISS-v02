import type { CompanySummary, DashboardMetric } from "@/types/dashboard";
import type { CompanyType, Project } from "@/types/project";

function summarizeCompany(projects: Project[], company: CompanyType): CompanySummary {
  const companyProjects = projects.filter((project) => project.company === company);
  const targetValue = companyProjects.reduce((sum, project) => sum + project.targetValue, 0);
  const currentValue = companyProjects.reduce((sum, project) => sum + project.currentValue, 0);
  const avgProgress =
    companyProjects.length === 0
      ? 0
      : companyProjects.reduce((sum, project) => sum + project.progress, 0) / companyProjects.length;

  return {
    company,
    projects: companyProjects.length,
    targetValue,
    currentValue,
    progress: avgProgress,
  };
}

export function calculateDashboard(projects: Project[], annualTarget: number) {
  const currentResult = projects.reduce((sum, project) => sum + project.currentValue, 0);
  const targetResult = annualTarget;
  const completion = targetResult === 0 ? 0 : (currentResult / targetResult) * 100;
  const averageProgress =
    projects.length === 0 ? 0 : projects.reduce((sum, project) => sum + project.progress, 0) / projects.length;

  const metrics: DashboardMetric[] = [
    {
      label: "Meta anual",
      value: String(targetResult),
      helper: "Objetivo consolidado do grupo",
    },
    {
      label: "Resultado atual",
      value: String(currentResult),
      helper: "Soma dos projetos ativos e concluídos",
    },
    {
      label: "Atingimento",
      value: String(completion),
      helper: "Percentual da meta já entregue",
    },
    {
      label: "Progresso médio",
      value: String(averageProgress),
      helper: "Média de evolução dos projetos",
    },
  ];

  const companySummaries = [
    summarizeCompany(projects, "ARGUS INTEL"),
    summarizeCompany(projects, "ARGUS SYSTEMS"),
  ];

  return {
    annualTarget: targetResult,
    currentResult,
    completion,
    averageProgress,
    metrics,
    companySummaries,
  };
}
