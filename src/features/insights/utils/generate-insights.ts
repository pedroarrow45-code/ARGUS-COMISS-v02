import { calculateDashboard } from "@/features/dashboard/utils/calculate-dashboard";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { Project } from "@/types/project";

export type InsightSummary = {
  totalProjects: number;
  annualCompletion: number;
  remainingToTarget: number;
  currentResult: number;
  averageProgress: number;
  delayedProjectsCount: number;
};

export type InsightTone = "positive" | "alert" | "informative";

export type InsightItem = {
  title: string;
  value?: string;
  helper: string;
  tone: InsightTone;
};

export type GeneratedInsights = {
  summary: InsightSummary;
  primaryInsights: InsightItem[];
  strategicObservations: InsightItem[];
};

export function generateInsights(projects: Project[], annualTarget: number): GeneratedInsights {
  const dashboard = calculateDashboard(projects, annualTarget);
  const totalProjects = projects.length;
  const remainingToTarget = Math.max(0, dashboard.annualTarget - dashboard.currentResult);
  const highestValueProject = [...projects].sort((a, b) => b.currentValue - a.currentValue)[0];
  const lowestProgressProject = [...projects].sort((a, b) => a.progress - b.progress)[0];
  const delayedProjectsCount = projects.filter((project) => project.progress < 50).length;

  if (totalProjects === 0) {
    return {
      summary: {
        totalProjects: 0,
        annualCompletion: 0,
        remainingToTarget: dashboard.annualTarget,
        currentResult: 0,
        averageProgress: 0,
        delayedProjectsCount: 0,
      },
      primaryInsights: [
        {
          title: "Projetos cadastrados",
          value: "0",
          helper: "Cadastre projetos para começar a gerar leituras executivas.",
          tone: "informative",
        },
        {
          title: "Atingimento da meta",
          value: "0%",
          helper: "Ainda não há entregas registradas na carteira.",
          tone: "informative",
        },
        {
          title: "Falta para a meta",
          value: formatCurrency(dashboard.annualTarget),
          helper: "Este é o valor total necessário para atingir a meta anual.",
          tone: "alert",
        },
        {
          title: "Média geral de progresso",
          value: "0%",
          helper: "A média de progresso será calculada quando houver projetos ativos.",
          tone: "informative",
        },
      ],
      strategicObservations: [
        {
          title: "Base ainda vazia",
          helper: "Ainda não há projetos cadastrados para gerar insights automáticos.",
          tone: "informative",
        },
        {
          title: "Meta ainda sem entrega",
          helper: `Faltam ${formatCurrency(dashboard.annualTarget)} para atingir a meta anual.`,
          tone: "alert",
        },
        {
          title: "Sem projeto líder",
          helper: "Ainda não foi possível identificar o projeto mais relevante.",
          tone: "informative",
        },
        {
          title: "Sem projeto atrasado identificado",
          helper: "Ainda não foi possível identificar o projeto com menor progresso.",
          tone: "informative",
        },
      ],
    };
  }

  const completionTone: InsightTone =
    dashboard.completion >= 70 ? "positive" : dashboard.completion >= 40 ? "informative" : "alert";
  const progressTone: InsightTone =
    dashboard.averageProgress >= 70 ? "positive" : dashboard.averageProgress >= 45 ? "informative" : "alert";
  const delayTone: InsightTone =
    delayedProjectsCount === 0 ? "positive" : delayedProjectsCount <= 2 ? "informative" : "alert";

  return {
    summary: {
      totalProjects,
      annualCompletion: dashboard.completion,
      remainingToTarget,
      currentResult: dashboard.currentResult,
      averageProgress: dashboard.averageProgress,
      delayedProjectsCount,
    },
    primaryInsights: [
      {
        title: "Atingimento da meta anual",
        value: formatPercent(dashboard.completion),
        helper: `Você já atingiu ${formatPercent(dashboard.completion)} da meta anual.`,
        tone: completionTone,
      },
      {
        title: "Falta para a meta",
        value: formatCurrency(remainingToTarget),
        helper: `Faltam ${formatCurrency(remainingToTarget)} para atingir a meta anual.`,
        tone: "alert",
      },
      {
        title: "Média geral de progresso",
        value: formatPercent(dashboard.averageProgress),
        helper: `A média de progresso da carteira é ${formatPercent(dashboard.averageProgress)}.`,
        tone: progressTone,
      },
      {
        title: "Projetos cadastrados",
        value: String(totalProjects),
        helper: `${totalProjects} projeto(s) estão compondo a carteira atual.`,
        tone: "informative",
      },
    ],
    strategicObservations: [
      {
        title: "Destaque de valor",
        helper: highestValueProject
          ? `O projeto mais relevante é ${highestValueProject.name} com ${formatCurrency(highestValueProject.currentValue)}.`
          : "Ainda não foi possível identificar o projeto de maior valor.",
        tone: "positive",
      },
      {
        title: "Ponto de atenção",
        helper: lowestProgressProject
          ? `O projeto mais atrasado é ${lowestProgressProject.name} com ${formatPercent(lowestProgressProject.progress)} de progresso.`
          : "Ainda não foi possível identificar o projeto com menor progresso.",
        tone: "alert",
      },
      {
        title: "Ritmo médio da carteira",
        helper: `A média de progresso da carteira é ${formatPercent(dashboard.averageProgress)}.`,
        tone: progressTone,
      },
      {
        title: "Cobertura da análise",
        helper: `Hoje existem ${totalProjects} projeto(s) cadastrados no sistema.`,
        tone: "informative",
      },
      {
        title: "Projetos em acompanhamento",
        helper: `${delayedProjectsCount} projeto(s) estão abaixo de 50% de progresso e pedem acompanhamento executivo.`,
        tone: delayTone,
      },
      {
        title: "Espaço para captura de meta",
        helper: `Faltam ${formatCurrency(remainingToTarget)} para atingir a meta anual.`,
        tone: "alert",
      },
    ],
  };
}
