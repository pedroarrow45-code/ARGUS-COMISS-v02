import { mockProjects } from "@/data/mock-projects";
import type { Project } from "@/types/project";

export const PROJECTS_STORAGE_KEY = "argus-group-projects";

function isValidProject(project: unknown): project is Project {
  if (!project || typeof project !== "object") {
    return false;
  }

  const candidate = project as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    (candidate.company === "ARGUS INTEL" || candidate.company === "ARGUS SYSTEMS") &&
    typeof candidate.owner === "string" &&
    (candidate.status === "Planejamento" ||
      candidate.status === "Em andamento" ||
      candidate.status === "Concluído") &&
    typeof candidate.progress === "number" &&
    typeof candidate.targetValue === "number" &&
    typeof candidate.currentValue === "number" &&
    typeof candidate.dueDate === "string"
  );
}

export function getFallbackProjects() {
  return mockProjects;
}

export function sanitizeProjects(value: unknown) {
  if (!Array.isArray(value)) {
    return getFallbackProjects();
  }

  const validProjects = value.filter(isValidProject);

  return validProjects.length > 0 ? validProjects : getFallbackProjects();
}
