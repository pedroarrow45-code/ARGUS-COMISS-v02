"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCurrency } from "@/lib/utils";
import type { Project } from "@/types/project";

type ProjectListProps = {
  projects: Project[];
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ProjectList({ projects, selectedProjectId, onSelect, onDelete }: ProjectListProps) {
  return (
    <div className="space-y-4">
      {projects.map((project) => {
        const isSelected = selectedProjectId === project.id;

        return (
          <Card key={project.id} className={isSelected ? "border-brand-500/40" : ""}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                    {project.company}
                  </span>
                  <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink/65">
                    {project.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-bold">{project.name}</h3>
                  <p className="mt-1 text-sm text-ink/55">{`Responsável: ${project.owner} | Prazo: ${project.dueDate}`}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-ink/65">
                    <span>Progresso</span>
                    <span className="font-semibold text-ink">{project.progress}%</span>
                  </div>
                  <ProgressBar value={project.progress} />
                </div>
              </div>

              <div className="flex min-w-0 sm:min-w-[220px] sm:max-w-[260px] flex-col gap-4">
                <div className="rounded-2xl bg-sand p-4">
                  <p className="text-sm text-ink/55">Resultado atual</p>
                  <p className="mt-1 break-words text-[1.65rem] font-bold leading-tight tracking-tight md:text-2xl">
                    {formatCurrency(project.currentValue)}
                  </p>
                  <p className="mt-1 break-words text-sm text-ink/55">Meta: {formatCurrency(project.targetValue)}</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant={isSelected ? "secondary" : "primary"}
                    onClick={() => onSelect(project.id)}
                  >
                    {isSelected ? "Em edição" : "Editar projeto"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => onDelete(project.id)}>
                    Excluir
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
