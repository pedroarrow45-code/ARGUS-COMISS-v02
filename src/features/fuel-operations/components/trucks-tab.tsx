"use client";

import { useMemo, useState } from "react";

import { formatCompactLiters, formatLiters, formatPercent } from "../format";
import { getTruckLoadState } from "../selectors";
import { useFuelOperationsStore } from "../store";
import type { Allocation, Truck } from "../types";
import styles from "./fuel-operations.module.css";
import { Card, ProgressBar, SectionLead, StatusBadge } from "./shared";
import { TruckForm } from "./truck-form";

export function TrucksTab({
  trucks,
  allocations,
}: {
  trucks: Truck[];
  allocations: Allocation[];
}) {
  const { upsertTruck } = useFuelOperationsStore();
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const truckStates = useMemo(
    () => trucks.map((truck) => getTruckLoadState(truck, allocations)),
    [allocations, trucks],
  );
  const editingTruck = trucks.find((truck) => truck.id === editingTruckId);

  return (
    <div className={styles.viewStack}>
      <SectionLead
        text="Cadastro e edicao de capacidade total, quantidade de bocas e limite individual de cada compartimento."
        title="Caminhoes e bocas"
      />

      <div className={styles.twoColumnGrid}>
        <Card
          subtitle="Visual da frota operacional usando a configuracao atual das bocas."
          title="Frota configurada"
        >
          <div className={styles.listStack}>
            {truckStates.map((truckState) => (
              <article className={styles.truckCard} key={truckState.truck.id}>
                <div className={styles.summaryRowHeader}>
                  <div>
                    <p className={styles.rowTitle}>{truckState.truck.name}</p>
                    <p className={styles.rowSubtitle}>{truckState.truck.identifier}</p>
                  </div>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => setEditingTruckId(truckState.truck.id)}
                    type="button"
                  >
                    Editar
                  </button>
                </div>

                <div className={styles.metaGrid}>
                  <div className={styles.metaChip}>
                    <span>Total</span>
                    <strong>{formatCompactLiters(truckState.truck.totalCapacityLiters)}</strong>
                  </div>
                  <div className={styles.metaChip}>
                    <span>Carregado</span>
                    <strong>{formatCompactLiters(truckState.loadedLiters)}</strong>
                  </div>
                  <div className={styles.metaChip}>
                    <span>Bocas</span>
                    <strong>{truckState.truck.compartments.length}</strong>
                  </div>
                </div>

                <div className={styles.summaryRow}>
                  <div className={styles.summaryRowHeader}>
                    <p className={styles.rowSubtitle}>Utilizacao atual</p>
                    <StatusBadge tone={truckState.remainingLiters > 0 ? "success" : "warning"}>
                      {formatPercent(truckState.utilizationPercentage)}
                    </StatusBadge>
                  </div>
                  <ProgressBar value={truckState.utilizationPercentage} />
                </div>

                <div className={styles.compartmentsRow}>
                  {truckState.compartments.map((compartment) => (
                    <div className={styles.compartmentCell} key={compartment.compartment.id}>
                      <p className={styles.compartmentLabel}>{compartment.compartment.label}</p>
                      <div className={styles.compartmentBar}>
                        <div
                          className={styles.compartmentFill}
                          style={{ height: `${compartment.fillPercentage}%` }}
                        />
                      </div>
                      <p className={styles.compartmentMeta}>
                        {formatCompactLiters(compartment.loadedLiters)} / {formatCompactLiters(compartment.compartment.capacityLiters)}
                      </p>
                    </div>
                  ))}
                </div>

                {truckState.compartmentGapLiters !== 0 ? (
                  <p className={styles.helperText}>
                    Soma das bocas: {formatLiters(truckState.compartmentSumLiters)}. Diferenca para o total:{" "}
                    {formatLiters(Math.abs(truckState.compartmentGapLiters))}.
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </Card>

        <Card
          subtitle={editingTruck ? `Editando ${editingTruck.name}.` : "Cadastre um novo caminhao com configuracao de bocas."}
          title={editingTruck ? "Editar caminhao" : "Novo caminhao"}
        >
          <TruckForm
            allocations={allocations}
            onCancel={() => setEditingTruckId(null)}
            onSaved={() => setEditingTruckId(null)}
            onSubmit={upsertTruck}
            truck={editingTruck}
            trucks={trucks}
          />
        </Card>
      </div>
    </div>
  );
}
