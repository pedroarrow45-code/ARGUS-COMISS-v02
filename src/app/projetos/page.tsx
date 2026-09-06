"use client";

import { useMemo } from "react";

import { ProjectForm } from "@/components/projects/project-form";
import { Button } from "@/components/ui/button";
import { ProjectList } from "@/components/projects/project-list";
import { Card } from "@/components/ui/card";
import { PageLoading } from "@/components/ui/page-loading";
import { formatCurrency } from "@/lib/utils";
import { useProjectStore } from "@/store/project-store";
import type { ProjectInput } from "@/types/project";

export default function ProjectsPage() {
  const projects = useProjectStore((state) => state.projects);
  const isGlobalLoading = useProjectStore((state) => state.isGlobalLoading);
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const selectProject = useProjectStore((state) => state.selectProject);
  const createProject = useProjectStore((state) => state.createProject);
  const updateProject = useProjectStore((state) => state.updateProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const resetProjects = useProjectStore((state) => state.resetProjects);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  function handleSubmit(input: ProjectInput) {
    if (selectedProject) {
      updateProject(selectedProject.id, input);
      return;
    }

    createProject(input);
  }

  if (isGlobalLoading) {
    return (
      <PageLoading
        variant="projects"
        title="Carregando projetos..."
        message="Sincronizando os dados salvos localmente."
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="space-y-6">
        <ProjectForm
          project={selectedProject}
          onSubmit={handleSubmit}
          onCancelEdit={() => selectProject(null)}
        />

        <Card className="space-y-3">
          <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Impacto automático</p>
          <h2 className="text-xl font-bold">Como essa tela conversa com o dashboard</h2>
          <p className="text-sm leading-6 text-ink/65">
            Cada cadastro ou edição atualiza a store global. A Home consome essa mesma fonte e recalcula meta,
            resultado atual e progresso médio sem duplicar dados.
          </p>
          <div className="pt-2">
            <Button type="button" variant="secondary" onClick={resetProjects}>
              Resetar dados
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Gestão de projetos</p>
            <h1 className="mt-2 text-3xl font-bold">Projetos da carteira ARGUS</h1>
            <p className="mt-2 max-w-2xl text-sm text-ink/65">
              Edite progresso, resultado e metas de cada iniciativa. O dashboard principal reflete tudo em tempo
              real.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[340px]">
            <div className="min-w-0 rounded-2xl bg-white px-4 py-3 ring-1 ring-ink/8">
              <p className="text-sm text-ink/55">Projetos</p>
              <p className="mt-1 break-words text-2xl font-bold leading-tight">{projects.length}</p>
            </div>
            <div className="min-w-0 rounded-2xl bg-white px-4 py-3 ring-1 ring-ink/8">
              <p className="text-sm text-ink/55">Total atual</p>
              <p className="mt-1 overflow-hidden break-words text-[1.65rem] font-bold leading-tight tracking-tight md:text-2xl">
                {formatCurrency(projects.reduce((sum, project) => sum + project.currentValue, 0))}
              </p>
            </div>
          </div>
        </Card>

        <ProjectList
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelect={selectProject}
          onDelete={deleteProject}
        />
      </div>
    </div>
  );
}
