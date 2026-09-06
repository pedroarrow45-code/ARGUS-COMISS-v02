"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Project, ProjectInput, ProjectStatus } from "@/types/project";

type ProjectFormProps = {
  project?: Project;
  onSubmit: (input: ProjectInput) => void;
  onCancelEdit?: () => void;
};

const statusOptions: ProjectStatus[] = ["Planejamento", "Em andamento", "Concluído"];

const defaultForm: ProjectInput = {
  name: "",
  company: "ARGUS INTEL",
  owner: "",
  status: "Planejamento",
  progress: 0,
  targetValue: 0,
  currentValue: 0,
  dueDate: "",
};

function projectToInput(project: Project): ProjectInput {
  const { id: _id, ...input } = project;
  return input;
}

export function ProjectForm({ project, onSubmit, onCancelEdit }: ProjectFormProps) {
  const [form, setForm] = useState<ProjectInput>(defaultForm);

  useEffect(() => {
    setForm(project ? projectToInput(project) : defaultForm);
  }, [project]);

  function handleChange<K extends keyof ProjectInput>(field: K, value: ProjectInput[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(form);

    if (!project) {
      setForm(defaultForm);
    }
  }

  return (
    <Card className="space-y-6">
      <div>
        <p className="section-eyebrow">Cadastro</p>
        <h3 className="section-title">{project ? "Editar projeto" : "Novo projeto"}</h3>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-ink/80">
            Nome do projeto
            <input
              required
              value={form.name}
              onChange={(event) => handleChange("name", event.target.value)}
              className="app-input"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-ink/80">
            Responsável
            <input
              required
              value={form.owner}
              onChange={(event) => handleChange("owner", event.target.value)}
              className="app-input"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-ink/80">
            Empresa
            <select
              value={form.company}
              onChange={(event) => handleChange("company", event.target.value as ProjectInput["company"])}
              className="app-input"
            >
              <option value="ARGUS INTEL">ARGUS INTEL</option>
              <option value="ARGUS SYSTEMS">ARGUS SYSTEMS</option>
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-ink/80">
            Status
            <select
              value={form.status}
              onChange={(event) => handleChange("status", event.target.value as ProjectStatus)}
              className="app-input"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-ink/80">
            Progresso (%)
            <input
              required
              min={0}
              max={100}
              type="number"
              value={form.progress}
              onChange={(event) => handleChange("progress", Number(event.target.value))}
              className="app-input"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-ink/80">
            Prazo
            <input
              required
              type="date"
              value={form.dueDate}
              onChange={(event) => handleChange("dueDate", event.target.value)}
              className="app-input"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-ink/80">
            Meta financeira
            <input
              required
              min={0}
              type="number"
              value={form.targetValue}
              onChange={(event) => handleChange("targetValue", Number(event.target.value))}
              className="app-input"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-ink/80">
            Resultado atual
            <input
              required
              min={0}
              type="number"
              value={form.currentValue}
              onChange={(event) => handleChange("currentValue", Number(event.target.value))}
              className="app-input"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit">{project ? "Salvar alterações" : "Adicionar projeto"}</Button>
          {project && onCancelEdit ? (
            <Button type="button" variant="secondary" onClick={onCancelEdit}>
              Cancelar edição
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
