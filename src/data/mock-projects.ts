import type { Project } from "@/types/project";

export const annualTarget = 4_500_000;

export const mockProjects: Project[] = [
  {
    id: "p-001",
    name: "Expansão Operacional Norte",
    company: "ARGUS INTEL",
    owner: "Mariana Lima",
    status: "Em andamento",
    progress: 74,
    targetValue: 1_200_000,
    currentValue: 920_000,
    dueDate: "2026-06-15",
  },
  {
    id: "p-002",
    name: "Modernização ERP Interno",
    company: "ARGUS SYSTEMS",
    owner: "Rafael Costa",
    status: "Em andamento",
    progress: 58,
    targetValue: 950_000,
    currentValue: 510_000,
    dueDate: "2026-08-30",
  },
  {
    id: "p-003",
    name: "Programa de Inteligência Comercial",
    company: "ARGUS INTEL",
    owner: "Camila Nunes",
    status: "Planejamento",
    progress: 28,
    targetValue: 780_000,
    currentValue: 180_000,
    dueDate: "2026-10-10",
  },
  {
    id: "p-004",
    name: "Automação de Suporte Técnico",
    company: "ARGUS SYSTEMS",
    owner: "Diego Matos",
    status: "Concluído",
    progress: 100,
    targetValue: 620_000,
    currentValue: 610_000,
    dueDate: "2026-02-12",
  },
];
