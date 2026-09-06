"use client";

import { FUEL_MAP } from "../catalog";
import { formatDateTime, formatLiters } from "../format";
import { getOrderLoadState, getTruckLoadState } from "../selectors";
import { useFuelOperationsStore } from "../store";
import type { Allocation, Order, Truck } from "../types";
import styles from "./fuel-operations.module.css";
import { Card, EmptyState, ProgressBar, SectionLead, StatusBadge } from "./shared";

export function SummaryTab({
  trucks,
  orders,
  allocations,
}: {
  trucks: Truck[];
  orders: Order[];
  allocations: Allocation[];
}) {
  const { removeAllocation } = useFuelOperationsStore();
  const truckStates = trucks.map((truck) => getTruckLoadState(truck, allocations));
  const orderStateById = new Map(orders.map((order) => [order.id, getOrderLoadState(order, allocations)]));
  const truckById = new Map(trucks.map((truck) => [truck.id, truck]));

  return (
    <div className={styles.viewStack}>
      <SectionLead
        text="Resumo consolidado do que foi encaixado, por caminhao, boca e pedido."
        title="Resumo da carga"
      />

      <div className={styles.listStack}>
        {truckStates.map((truckState) => (
          <Card
            key={truckState.truck.id}
            subtitle={`${formatLiters(truckState.loadedLiters)} carregados e ${formatLiters(truckState.remainingLiters)} livres.`}
            title={truckState.truck.name}
          >
            <div className={styles.summaryRow}>
              <div className={styles.summaryRowHeader}>
                <p className={styles.rowSubtitle}>{truckState.truck.identifier}</p>
                <StatusBadge tone={truckState.remainingLiters > 0 ? "success" : "warning"}>
                  {formatLiters(truckState.truck.totalCapacityLiters)} total
                </StatusBadge>
              </div>
              <ProgressBar value={truckState.utilizationPercentage} />
            </div>

            <div className={styles.summaryGrid}>
              {truckState.compartments.map((compartment) => (
                <div className={styles.summaryBox} key={compartment.compartment.id}>
                  <div className={styles.summaryRowHeader}>
                    <p className={styles.rowTitle}>{compartment.compartment.label}</p>
                    <StatusBadge tone={compartment.remainingLiters > 0 ? "success" : "warning"}>
                      {formatLiters(compartment.remainingLiters)} livres
                    </StatusBadge>
                  </div>
                  <p className={styles.rowSubtitle}>
                    Capacidade {formatLiters(compartment.compartment.capacityLiters)}
                    {compartment.fuelType ? ` | ${FUEL_MAP[compartment.fuelType].label}` : " | Livre"}
                  </p>
                  {compartment.allocations.length === 0 ? (
                    <p className={styles.cellSubtitle}>Nenhuma alocacao nesta boca.</p>
                  ) : (
                    <div className={styles.listStack}>
                      {compartment.allocations.map((allocation) => {
                        const orderState = orderStateById.get(allocation.orderId);

                        return (
                          <div className={styles.allocationItem} key={allocation.id}>
                            <div>
                              <p className={styles.cellTitle}>
                                {orderState?.order.code ?? allocation.orderId} | {formatLiters(allocation.liters)}
                              </p>
                              <p className={styles.cellSubtitle}>
                                {orderState?.order.customer ?? "Pedido"} | {formatDateTime(allocation.createdAt)}
                              </p>
                            </div>
                            <button
                              className={styles.ghostButton}
                              onClick={() => removeAllocation(allocation.id)}
                              type="button"
                            >
                              Remover
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card subtitle="Relacao completa das alocacoes registradas neste MVP." title="Historico de alocacoes">
        {allocations.length === 0 ? (
          <EmptyState text="Nenhuma alocacao registrada ainda." title="Sem alocacoes" />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Caminhao</th>
                  <th>Boca</th>
                  <th>Combustivel</th>
                  <th>Litros</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((allocation) => {
                  const orderState = orderStateById.get(allocation.orderId);
                  const truck = truckById.get(allocation.truckId);

                  return (
                    <tr key={allocation.id}>
                      <td>
                        <p className={styles.cellTitle}>{orderState?.order.code ?? allocation.orderId}</p>
                        <p className={styles.cellSubtitle}>{orderState?.order.customer ?? "Cliente"}</p>
                      </td>
                      <td>{truck?.name ?? allocation.truckId}</td>
                      <td>{allocation.compartmentId}</td>
                      <td>{FUEL_MAP[allocation.fuelType].label}</td>
                      <td>{formatLiters(allocation.liters)}</td>
                      <td>{formatDateTime(allocation.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
