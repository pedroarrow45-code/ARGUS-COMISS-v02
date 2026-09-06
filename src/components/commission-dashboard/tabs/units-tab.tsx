"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { createUnit, deleteUnit, updateUnit } from "@/features/commission-dashboard/actions/units";
import type { UnitsOverview, UnitsRow } from "@/features/commission-dashboard/types/units-data";
import { formatCurrency, percent, progressTone } from "@/lib/commission-dashboard";

import { DashboardIcon } from "../icons";
import {
  type BadgeTone,
  AlertBox,
  EmptyState,
  Field,
  FilterBar,
  Input,
  Modal,
  NumberInput,
  PageHeader,
  ProgressBar,
  SearchField,
  ShellButton,
  StatusBadge,
} from "../ui";

export function UnitsTab({ overview }: { overview: UnitsOverview }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const units = overview.units;

  const [search, setSearch] = useState("");
  const [modalMode, setModalMode] = useState<"add" | string | null>(null);
  const [confirmingUnit, setConfirmingUnit] = useState<UnitsRow | null>(null);
  const [form, setForm] = useState({ name: "", goal: "", result: "" });

  const filteredUnits = useMemo(
    () => units.filter((unit) => unit.name.toLowerCase().includes(search.toLowerCase())),
    [search, units],
  );

  function getEmployeesForUnit(unitId: string) {
    return units.find((unit) => unit.id === unitId)?.employeesCount ?? 0;
  }

  function openAddModal() {
    setForm({ name: "", goal: "", result: "" });
    setModalMode("add");
  }

  function openEditModal(unit: UnitsRow) {
    setForm({ name: unit.name, goal: String(unit.goal), result: String(unit.result) });
    setModalMode(unit.id);
  }

  function closeModal() {
    setModalMode(null);
  }

  function saveUnit() {
    if (!form.name || !form.goal) {
      return;
    }

    const { year, month } = overview.period;
    const goal = Number(form.goal) || 0;
    const result = Number(form.result) || 0;

    startTransition(async () => {
      const actionResult =
        modalMode === "add"
          ? await createUnit({ name: form.name, goal, result, year, month })
          : modalMode
            ? await updateUnit({ id: modalMode, name: form.name, goal, result, year, month })
            : null;

      if (actionResult && !actionResult.success) {
        alert(actionResult.error);
        return;
      }

      setModalMode(null);
      router.refresh();
    });
  }

  function removeUnit(unitId: string) {
    startTransition(async () => {
      const result = await deleteUnit(unitId);

      if (!result.success) {
        alert(result.error);
        setConfirmingUnit(null);
        return;
      }

      setConfirmingUnit(null);
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader
        title="Gestão de Unidades"
        description="Cadastro e acompanhamento das unidades da Rede Horizonte"
        actions={
          <ShellButton onClick={openAddModal}>
            <DashboardIcon name="plus" className="h-[14px] w-[14px]" />
            Nova Unidade
          </ShellButton>
        }
      />

      <FilterBar>
        <SearchField value={search} placeholder="Buscar unidade..." onChange={setSearch} />
      </FilterBar>

      <div className="overflow-hidden rounded-[10px] border border-border bg-surface shadow-panel">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr>
                {["Unidade", "Meta Mensal", "Resultado", "% Meta", "Funcionários", "Comissão", "Ações"].map((title) => (
                  <th
                    key={title}
                    className="border-b border-border bg-surface-2 px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[1.2px] text-text-muted"
                  >
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUnits.length === 0 ? (
                <EmptyState
                  icon={<DashboardIcon name="units" className="h-10 w-10" />}
                  message="Nenhuma unidade encontrada."
                  colSpan={7}
                />
              ) : null}
              {filteredUnits.map((unit) => {
                const completion = percent(unit.result, unit.goal);
                const employeesCount = getEmployeesForUnit(unit.id);
                return (
                  <tr key={unit.id} className="group">
                    <td className="border-b border-border px-3.5 py-3 text-[13px] font-semibold text-text-primary group-hover:bg-surface-2">
                      {unit.name}
                    </td>
                    <td className="border-b border-border px-3.5 py-3 font-mono text-[12px] group-hover:bg-surface-2">
                      {formatCurrency(unit.goal)}
                    </td>
                    <td className="border-b border-border px-3.5 py-3 font-mono text-[12px] group-hover:bg-surface-2">
                      {formatCurrency(unit.result)}
                    </td>
                    <td className="border-b border-border px-3.5 py-3 group-hover:bg-surface-2">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={Number(completion)} tone={progressTone(completion)} className="w-[60px]" />
                        <StatusBadge tone={progressTone(completion) as BadgeTone}>{completion}%</StatusBadge>
                      </div>
                    </td>
                    <td className="border-b border-border px-3.5 py-3 group-hover:bg-surface-2">
                      <StatusBadge tone="navy">{employeesCount} func.</StatusBadge>
                    </td>
                    <td className="border-b border-border px-3.5 py-3 font-mono text-[12px] font-semibold text-gold-600 group-hover:bg-surface-2">
                      {unit.totalCommission > 0 ? formatCurrency(unit.totalCommission) : "—"}
                    </td>
                    <td className="border-b border-border px-3.5 py-3 group-hover:bg-surface-2">
                      <div className="flex gap-2">
                        <ShellButton variant="outline" size="sm" onClick={() => openEditModal(unit)}>
                          <DashboardIcon name="edit" className="h-[14px] w-[14px]" />
                          Editar
                        </ShellButton>
                        <ShellButton variant="danger" size="sm" onClick={() => setConfirmingUnit(unit)}>
                          <DashboardIcon name="trash" className="h-[14px] w-[14px]" />
                        </ShellButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalMode ? (
        <Modal
          title={modalMode === "add" ? "Nova Unidade" : "Editar Unidade"}
          onClose={closeModal}
          footer={
            <>
              <ShellButton variant="outline" onClick={closeModal}>
                Cancelar
              </ShellButton>
              <ShellButton onClick={saveUnit}>
                <DashboardIcon name="check" className="h-[14px] w-[14px]" />
                Salvar
              </ShellButton>
            </>
          }
        >
          <Field label="Nome da Unidade *">
            <Input
              value={form.name}
              placeholder="Ex: Horizonte Centro"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Meta Mensal (R$) *">
              <NumberInput
                value={form.goal}
                placeholder="120000"
                onValueChange={(value) => setForm((current) => ({ ...current, goal: value }))}
              />
            </Field>
            <Field label="Resultado Atual (R$)">
              <NumberInput
                value={form.result}
                placeholder="0"
                onValueChange={(value) => setForm((current) => ({ ...current, result: value }))}
              />
            </Field>
          </div>
          <AlertBox tone="info" className="mt-1">
            A comissão é calculada automaticamente ao fechar o mês, com base nas regras de cada funcionário.
          </AlertBox>
        </Modal>
      ) : null}

      {confirmingUnit ? (
        <Modal
          title="Confirmar exclusão"
          onClose={() => setConfirmingUnit(null)}
          footer={
            <>
              <ShellButton variant="outline" onClick={() => setConfirmingUnit(null)}>
                Cancelar
              </ShellButton>
              <ShellButton variant="danger" onClick={() => removeUnit(confirmingUnit.id)}>
                <DashboardIcon name="trash" className="h-[14px] w-[14px]" />
                Excluir
              </ShellButton>
            </>
          }
        >
          <p className="text-[13px] text-text-secondary">
            Tem certeza que deseja remover <strong>{confirmingUnit.name}</strong>? Esta ação não pode ser desfeita.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
