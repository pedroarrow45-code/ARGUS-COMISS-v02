"use client";

import { useEffect, useMemo, useState } from "react";

import type { ActionResult, Allocation, Truck, TruckCompartment, TruckFormInput } from "../types";
import { createId } from "../utils";
import styles from "./fuel-operations.module.css";
import { cx } from "./shared";

function createDraftCompartment(): TruckCompartment {
  return {
    id: createId("compartment"),
    label: "Boca",
    capacityLiters: 0,
  };
}

function createEmptyTruckDraft(): TruckFormInput {
  return {
    name: "",
    identifier: "",
    totalCapacityLiters: 0,
    compartments: [createDraftCompartment()],
  };
}

function toDraft(truck?: Truck): TruckFormInput {
  if (!truck) {
    return createEmptyTruckDraft();
  }

  return {
    id: truck.id,
    name: truck.name,
    identifier: truck.identifier,
    totalCapacityLiters: truck.totalCapacityLiters,
    compartments: truck.compartments.map((compartment) => ({ ...compartment })),
  };
}

export function TruckForm({
  truck,
  allocations,
  trucks,
  onSubmit,
  onSaved,
  onCancel,
}: {
  truck?: Truck;
  allocations: Allocation[];
  trucks: Truck[];
  onSubmit: (input: TruckFormInput) => ActionResult;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<TruckFormInput>(() => toDraft(truck));

  useEffect(() => {
    setDraft(toDraft(truck));
  }, [truck]);

  const totalCompartments = useMemo(
    () => draft.compartments.reduce((total, compartment) => total + (Number.isFinite(compartment.capacityLiters) ? compartment.capacityLiters : 0), 0),
    [draft.compartments],
  );

  const loadWarnings = useMemo(() => {
    const currentTruck = truck ?? trucks.find((currentTruckItem) => currentTruckItem.id === draft.id);

    if (!currentTruck) {
      return new Map<string, number>();
    }

    const loads = new Map<string, number>();
    allocations
      .filter((allocation) => allocation.truckId === currentTruck.id)
      .forEach((allocation) => {
        loads.set(allocation.compartmentId, (loads.get(allocation.compartmentId) ?? 0) + allocation.liters);
      });

    return loads;
  }, [allocations, draft.id, truck, trucks]);

  const sumStatus =
    totalCompartments > draft.totalCapacityLiters
      ? "error"
      : totalCompartments < draft.totalCapacityLiters
        ? "warning"
        : "success";

  function updateCompartment(index: number, capacityLiters: number) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      compartments: currentDraft.compartments.map((compartment, currentIndex) =>
        currentIndex === index ? { ...compartment, capacityLiters } : compartment,
      ),
    }));
  }

  function handleSubmit() {
    const result = onSubmit(draft);

    if (result.tone === "error") {
      return;
    }

    if (truck) {
      onSaved();
      return;
    }

    setDraft(createEmptyTruckDraft());
  }

  return (
    <div className={styles.formStack}>
      <div className={styles.formGrid}>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Nome do caminhao</span>
          <input
            className={styles.input}
            onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, name: event.currentTarget.value }))}
            placeholder="Ex.: Caminhao 3"
            type="text"
            value={draft.name}
          />
        </label>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Identificacao</span>
          <input
            className={styles.input}
            onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, identifier: event.currentTarget.value }))}
            placeholder="Ex.: CT-03 / Volvo FH"
            type="text"
            value={draft.identifier}
          />
        </label>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Capacidade total (L)</span>
          <input
            className={styles.input}
            min={0}
            onChange={(event) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                totalCapacityLiters: Number(event.currentTarget.value),
              }))
            }
            type="number"
            value={draft.totalCapacityLiters || ""}
          />
        </label>
      </div>

      <div className={styles.inlineHeader}>
        <div>
          <p className={styles.cardTitle}>Bocas do caminhao</p>
          <p className={styles.cardSubtitle}>A soma deve respeitar a capacidade total cadastrada.</p>
        </div>
        <button
          className={styles.secondaryButton}
          onClick={() =>
            setDraft((currentDraft) => ({
              ...currentDraft,
              compartments: [...currentDraft.compartments, createDraftCompartment()],
            }))
          }
          type="button"
        >
          Adicionar boca
        </button>
      </div>

      <div className={styles.formStack}>
        {draft.compartments.map((compartment, index) => {
          const currentLoad = loadWarnings.get(compartment.id) ?? 0;

          return (
            <div className={styles.compartmentEditor} key={compartment.id}>
              <div className={styles.compartmentEditorHeader}>
                <p className={styles.compartmentEditorTitle}>Boca {index + 1}</p>
                <button
                  className={styles.ghostButton}
                  disabled={draft.compartments.length === 1}
                  onClick={() =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      compartments: currentDraft.compartments.filter((item) => item.id !== compartment.id),
                    }))
                  }
                  type="button"
                >
                  Remover
                </button>
              </div>
              <input
                className={styles.input}
                min={0}
                onChange={(event) => updateCompartment(index, Number(event.currentTarget.value))}
                type="number"
                value={compartment.capacityLiters || ""}
              />
              {currentLoad > 0 ? (
                <p className={styles.helperText}>Volume ja alocado nesta boca: {currentLoad.toLocaleString("pt-BR")} L</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className={cx(styles.capacitySummary, styles[`capacitySummary${sumStatus}` as keyof typeof styles])}>
        <p className={styles.capacityValue}>Soma das bocas: {totalCompartments.toLocaleString("pt-BR")} L</p>
        <p className={styles.capacityHelper}>
          Capacidade total: {draft.totalCapacityLiters.toLocaleString("pt-BR")} L
        </p>
      </div>

      <div className={styles.formActions}>
        <button className={styles.primaryButton} onClick={handleSubmit} type="button">
          {truck ? "Salvar alteracoes" : "Cadastrar caminhao"}
        </button>
        {truck && onCancel ? (
          <button className={styles.secondaryButton} onClick={onCancel} type="button">
            Cancelar edicao
          </button>
        ) : null}
      </div>
    </div>
  );
}
