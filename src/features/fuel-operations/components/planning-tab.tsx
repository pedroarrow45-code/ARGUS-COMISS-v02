"use client";

import { FUEL_MAP } from "../catalog";
import { formatLiters, formatPercent } from "../format";
import { getOrderLoadState, getTruckLoadState } from "../selectors";
import { useFuelOperationsStore } from "../store";
import type { Allocation, Order, Truck } from "../types";
import styles from "./fuel-operations.module.css";
import { Card, EmptyState, ProgressBar, SectionLead, StatusBadge } from "./shared";
import { ManualAllocationForm } from "./manual-allocation-form";

export function PlanningTab({
  trucks,
  orders,
  allocations,
}: {
  trucks: Truck[];
  orders: Order[];
  allocations: Allocation[];
}) {
  const { allocateOrder, applySuggestedAllocation, autoAllocatePendingOrders } = useFuelOperationsStore();
  const truckStates = trucks.map((truck) => getTruckLoadState(truck, allocations));
  const orderStates = orders
    .map((order) => getOrderLoadState(order, allocations))
    .sort((left, right) => right.remainingLiters - left.remainingLiters);
  const pendingOrderStates = orderStates.filter((orderState) => orderState.remainingLiters > 0);

  return (
    <div className={styles.viewStack}>
      <SectionLead
        text="Montagem manual e sugestao automatica simples para distribuir pedidos nas bocas validas."
        title="Montagem de carga"
      />

      <div className={styles.twoColumnGrid}>
        <Card subtitle="Selecione pedido, caminhao, boca e litros para encaixe manual." title="Alocacao manual">
          <ManualAllocationForm onSubmit={allocateOrder} orderStates={orderStates} truckStates={truckStates} />
        </Card>

        <Card
          actions={
            <button className={styles.primaryButton} onClick={autoAllocatePendingOrders} type="button">
              Distribuir pendentes
            </button>
          }
          subtitle="Sugestao automatica baseada em capacidade restante e combustivel compativel."
          title="Apoio ao planejamento"
        >
          <div className={styles.listStack}>
            <div className={styles.summaryRow}>
              <div className={styles.summaryRowHeader}>
                <p className={styles.rowTitle}>Pedidos com saldo pendente</p>
                <StatusBadge tone="warning">{pendingOrderStates.length}</StatusBadge>
              </div>
              <p className={styles.rowSubtitle}>
                {formatLiters(pendingOrderStates.reduce((total, orderState) => total + orderState.remainingLiters, 0))} aguardando encaixe.
              </p>
            </div>
            <div className={styles.summaryRow}>
              <div className={styles.summaryRowHeader}>
                <p className={styles.rowTitle}>Capacidade ainda disponivel</p>
                <StatusBadge tone="success">
                  {formatLiters(truckStates.reduce((total, truckState) => total + truckState.remainingLiters, 0))}
                </StatusBadge>
              </div>
              <p className={styles.rowSubtitle}>A distribuicao sugere encaixes validos, sem algoritmos complexos.</p>
            </div>
          </div>
        </Card>
      </div>

      <Card subtitle="Cada pedido mostra saldo pendente, progresso e acesso rapido a sugestao." title="Pedidos para encaixar">
        {pendingOrderStates.length === 0 ? (
          <EmptyState text="Nao ha pedidos restantes para distribuir nas bocas." title="Tudo encaixado" />
        ) : (
          <div className={styles.listStack}>
            {pendingOrderStates.map((orderState) => (
              <div className={styles.orderPlanningCard} key={orderState.order.id}>
                <div className={styles.summaryRowHeader}>
                  <div>
                    <p className={styles.rowTitle}>
                      {orderState.order.code} | {orderState.order.customer}
                    </p>
                    <p className={styles.rowSubtitle}>
                      {FUEL_MAP[orderState.order.fuelType].label} | {formatLiters(orderState.order.liters)}
                    </p>
                  </div>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => applySuggestedAllocation(orderState.order.id)}
                    type="button"
                  >
                    Aplicar sugestao
                  </button>
                </div>
                <ProgressBar color={FUEL_MAP[orderState.order.fuelType].color} value={orderState.fillPercentage} />
                <div className={styles.metaRow}>
                  <span>{formatLiters(orderState.allocatedLiters)} alocados</span>
                  <span>{formatLiters(orderState.remainingLiters)} pendentes</span>
                </div>
                {orderState.allocations.length > 0 ? (
                  <div className={styles.inlineList}>
                    {orderState.allocations.map((allocation) => (
                      <span className={styles.inlineTag} key={allocation.id}>
                        {allocation.truckId} / {allocation.compartmentId} / {formatLiters(allocation.liters)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card subtitle="Leitura visual da ocupacao de cada boca para apoiar a tomada de decisao diaria." title="Ocupacao atual das bocas">
        <div className={styles.truckGrid}>
          {truckStates.map((truckState) => (
            <article className={styles.truckCard} key={truckState.truck.id}>
              <div className={styles.summaryRowHeader}>
                <div>
                  <p className={styles.rowTitle}>{truckState.truck.name}</p>
                  <p className={styles.rowSubtitle}>{truckState.truck.identifier}</p>
                </div>
                <StatusBadge tone={truckState.remainingLiters > 0 ? "success" : "warning"}>
                  {formatPercent(truckState.utilizationPercentage)}
                </StatusBadge>
              </div>
              <div className={styles.compartmentsRow}>
                {truckState.compartments.map((compartment) => (
                  <div className={styles.compartmentCell} key={compartment.compartment.id}>
                    <p className={styles.compartmentLabel}>{compartment.compartment.label}</p>
                    <div className={styles.compartmentBar}>
                      <div
                        className={styles.compartmentFill}
                        style={{
                          background: compartment.fuelType ? FUEL_MAP[compartment.fuelType].color : undefined,
                          height: `${compartment.fillPercentage}%`,
                        }}
                      />
                    </div>
                    <p className={styles.compartmentMeta}>{formatLiters(compartment.remainingLiters)} livres</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}
