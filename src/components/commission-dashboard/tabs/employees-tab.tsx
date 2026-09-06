"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { createEmployee, deleteEmployee, updateEmployee } from "@/features/commission-dashboard/actions/employees";
import type { EmployeesOverview, EmployeesRow } from "@/features/commission-dashboard/types/employees-data";
import { formatCurrency, initials } from "@/lib/commission-dashboard";

import { DashboardIcon } from "../icons";
import {
  Avatar,
  EmptyState,
  Field,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  SearchField,
  Select,
  ShellButton,
  StatusBadge,
} from "../ui";

export function EmployeesTab({ overview }: { overview: EmployeesOverview }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const employees = overview.employees;
  const units = overview.units;

  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [modalMode, setModalMode] = useState<"add" | string | null>(null);
  const [confirmingEmployee, setConfirmingEmployee] = useState<EmployeesRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    unitId: "",
    status: "ativo" as EmployeesRow["status"],
    shift: "diurno" as EmployeesRow["shift"],
    employmentType: "efetivado" as EmployeesRow["employmentType"],
  });

  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        const matchesSearch = employee.name.toLowerCase().includes(search.toLowerCase());
        const matchesUnit = unitFilter ? employee.unitId === unitFilter : true;
        return matchesSearch && matchesUnit;
      }),
    [employees, search, unitFilter],
  );

  function getUnit(unitId: string) {
    return units.find((unit) => unit.id === unitId);
  }

  function openAddModal() {
    setForm({ name: "", unitId: units[0] ? String(units[0].id) : "", status: "ativo", shift: "diurno", employmentType: "efetivado" });
    setModalMode("add");
  }

  function openEditModal(employee: EmployeesRow) {
    setForm({
      name: employee.name,
      unitId: String(employee.unitId),
      status: employee.status,
      shift: employee.shift,
      employmentType: employee.employmentType,
    });
    setModalMode(employee.id);
  }

  function closeModal() {
    setModalMode(null);
  }

  function saveEmployee() {
    if (!form.name || !form.unitId) {
      return;
    }

    const dbStatus = form.status === "ativo" ? ("ACTIVE" as const) : ("INACTIVE" as const);
    const dbShift = form.shift === "diurno" ? ("DAYTIME" as const) : ("NIGHTTIME" as const);
    const dbEmploymentType = form.employmentType === "efetivado" ? ("PERMANENT" as const) : ("PROBATION" as const);
    const payload = { name: form.name, unitId: form.unitId, status: dbStatus, shift: dbShift, employmentType: dbEmploymentType };

    startTransition(async () => {
      const result =
        modalMode === "add"
          ? await createEmployee(payload)
          : modalMode
            ? await updateEmployee({ id: modalMode, ...payload })
            : null;

      if (result && !result.success) {
        alert(result.error);
        return;
      }

      setModalMode(null);
      router.refresh();
    });
  }

  function removeEmployee(employeeId: string) {
    startTransition(async () => {
      const result = await deleteEmployee(employeeId);

      if (!result.success) {
        alert(result.error);
        setConfirmingEmployee(null);
        return;
      }

      setConfirmingEmployee(null);
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader
        title="Gestão de Funcionários"
        description="Cadastro de colaboradores vinculados às unidades da rede"
        actions={
          <ShellButton onClick={openAddModal}>
            <DashboardIcon name="plus" className="h-[14px] w-[14px]" />
            Novo Funcionário
          </ShellButton>
        }
      />

      <FilterBar>
        <SearchField value={search} placeholder="Buscar funcionário..." onChange={setSearch} />
        <Select className="md:w-[220px]" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}>
          <option value="">Todas as unidades</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </Select>
      </FilterBar>

      <div className="overflow-hidden border-y border-border-dark bg-surface/60">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr>
                {["Funcionário", "Unidade", "Vínculo", "Turno", "Status", "Comissão", "Ações"].map((title) => (
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
              {filteredEmployees.length === 0 ? (
                <EmptyState
                  icon={<DashboardIcon name="users" className="h-10 w-10" />}
                  message="Nenhum funcionário encontrado."
                  colSpan={7}
                />
              ) : null}
              {filteredEmployees.map((employee) => {
                const unit = getUnit(employee.unitId);

                return (
                  <tr key={employee.id} className="group">
                    <td className="border-b border-border px-3.5 py-3 group-hover:bg-surface-2">
                      <div className="flex items-center gap-2">
                        <Avatar label={initials(employee.name)} />
                        <span className="text-[13px] font-semibold text-text-primary">{employee.name}</span>
                      </div>
                    </td>
                    <td className="border-b border-border px-3.5 py-3 group-hover:bg-surface-2">
                      <StatusBadge tone="navy">{unit?.name ?? "—"}</StatusBadge>
                    </td>
                    <td className="border-b border-border px-3.5 py-3 group-hover:bg-surface-2">
                      <StatusBadge tone={employee.employmentType === "experiencia" ? "gold" : "gray"}>{employee.employmentType === "experiencia" ? "Experiência" : "Efetivo"}</StatusBadge>
                    </td>
                    <td className="border-b border-border px-3.5 py-3 text-[11px] font-semibold uppercase tracking-[0.5px] text-text-secondary group-hover:bg-surface-2">
                      {employee.shift === "noturno" ? "Noturno" : "Diurno"}
                    </td>
                    <td className="border-b border-border px-3.5 py-3 group-hover:bg-surface-2">
                      <StatusBadge tone={employee.status === "ativo" ? "green" : "gray"}>
                        {employee.status === "ativo" ? "Ativo" : "Inativo"}
                      </StatusBadge>
                    </td>
                    <td className="border-b border-border px-3.5 py-3 text-right font-mono text-[12px] font-semibold text-text-primary group-hover:bg-surface-2">
                      {employee.totalCommission != null ? formatCurrency(employee.totalCommission) : "—"}
                    </td>
                    <td className="border-b border-border px-3.5 py-3 group-hover:bg-surface-2">
                      <div className="flex gap-2">
                        <ShellButton variant="outline" size="sm" onClick={() => openEditModal(employee)}>
                          <DashboardIcon name="edit" className="h-[14px] w-[14px]" />
                          Editar
                        </ShellButton>
                        <ShellButton variant="danger" size="sm" onClick={() => setConfirmingEmployee(employee)}>
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
          title={modalMode === "add" ? "Novo Funcionário" : "Editar Funcionário"}
          onClose={closeModal}
          footer={
            <>
              <ShellButton variant="outline" onClick={closeModal}>
                Cancelar
              </ShellButton>
              <ShellButton onClick={saveEmployee}>
                <DashboardIcon name="check" className="h-[14px] w-[14px]" />
                Salvar
              </ShellButton>
            </>
          }
        >
          <Field label="Nome Completo *">
            <Input
              value={form.name}
              placeholder="Nome do funcionário"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label="Unidade *">
            <Select
              value={form.unitId}
              onChange={(event) => setForm((current) => ({ ...current, unitId: event.target.value }))}
            >
              <option value="">Selecionar unidade...</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value as EmployeesRow["status"] }))
              }
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </Select>
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Turno">
              <Select
                value={form.shift}
                onChange={(event) =>
                  setForm((current) => ({ ...current, shift: event.target.value as EmployeesRow["shift"] }))
                }
              >
                <option value="diurno">Diurno</option>
                <option value="noturno">Noturno</option>
              </Select>
            </Field>
            <Field label="Tipo de Vínculo">
              <Select
                value={form.employmentType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, employmentType: event.target.value as EmployeesRow["employmentType"] }))
                }
              >
                <option value="efetivado">Efetivado</option>
                <option value="experiencia">Experiência</option>
              </Select>
            </Field>
          </div>
        </Modal>
      ) : null}

      {confirmingEmployee ? (
        <Modal
          title="Confirmar exclusão"
          onClose={() => setConfirmingEmployee(null)}
          footer={
            <>
              <ShellButton variant="outline" onClick={() => setConfirmingEmployee(null)}>
                Cancelar
              </ShellButton>
              <ShellButton variant="danger" onClick={() => removeEmployee(confirmingEmployee.id)}>
                <DashboardIcon name="trash" className="h-[14px] w-[14px]" />
                Excluir
              </ShellButton>
            </>
          }
        >
          <p className="text-[13px] text-text-secondary">
            Tem certeza que deseja remover <strong>{confirmingEmployee.name}</strong>?
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
