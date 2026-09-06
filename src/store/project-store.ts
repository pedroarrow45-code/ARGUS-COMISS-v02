"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { annualTarget as defaultAnnualTarget } from "@/data/mock-projects";
import { PROJECTS_STORAGE_KEY, getFallbackProjects, sanitizeProjects } from "@/lib/project-storage";
import type { Project, ProjectInput } from "@/types/project";

type ProjectStore = {
  projects: Project[];
  annualTarget: number;
  selectedProjectId: string | null;
  isHydrated: boolean;
  isGlobalLoading: boolean;
  selectProject: (id: string | null) => void;
  createProject: (project: ProjectInput) => void;
  updateProject: (id: string, project: ProjectInput) => void;
  deleteProject: (id: string) => void;
  resetProjects: () => void;
  setAnnualTarget: (value: number) => void;
  setHydrated: (value: boolean) => void;
};

function sanitizeAnnualTarget(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : defaultAnnualTarget;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      projects: [],
      annualTarget: defaultAnnualTarget,
      selectedProjectId: null,
      isHydrated: false,
      isGlobalLoading: true,
      setHydrated: (value) => set({ isHydrated: value, isGlobalLoading: !value }),
      setAnnualTarget: (value) => set({ annualTarget: Math.max(0, value) }),
      selectProject: (id) => set({ selectedProjectId: id }),
      createProject: (project) =>
        set((state) => ({
          projects: [
            {
              id: crypto.randomUUID(),
              ...project,
            },
            ...state.projects,
          ],
          selectedProjectId: null,
        })),
      updateProject: (id, project) =>
        set((state) => ({
          projects: state.projects.map((item) =>
            item.id === id
              ? {
                  id,
                  ...project,
                }
              : item,
          ),
          selectedProjectId: null,
        })),
      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((item) => item.id !== id),
          selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
        })),
      resetProjects: () =>
        set({
          projects: getFallbackProjects(),
          selectedProjectId: null,
        }),
    }),
    {
      name: PROJECTS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projects: state.projects,
        annualTarget: state.annualTarget,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ProjectStore> | undefined;

        return {
          ...currentState,
          projects: sanitizeProjects(persisted?.projects),
          annualTarget: sanitizeAnnualTarget(persisted?.annualTarget),
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
