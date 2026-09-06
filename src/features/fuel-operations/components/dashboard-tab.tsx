"use client";

import { FUEL_OPTIONS } from "../catalog";
import { formatCompactLiters, formatLiters, formatPercent } from "../format";
import { getDashboardSummary } from "../selectors";
import type { AlertItem, Allocation, Order, Truck } from "../types";
import styles from "./fuel-operations.module.css";
import { Card, EmptyState, MetricCard, ProgressBar, SectionLead, StatusBadge } from "./shared";

export function DashboardTab({
  trucks,
  orders,
  allocations,
  alerts,
}: {
  trucks: Truck[];
  orders: Order[];
  allocations: Allocation[];
  alerts: AlertItem[];
}) {
  const summary = getDashboardSummary(trucks, orders, allocations);
  const loadedByFuel = FUEL_OPTIONS.map((fuel) => ({
    ...fuel,
    liters: allocations
      .filter((allocation) => allocation.fuelType === fuel.id)
      .reduce((total, allocation) => total + allocation.liters, 0),
  })).filter((item) => item.liters > 0);

  return (
    <div className={styles.viewStack}>
      <SectionLead
        text="Visao operacional do carregamento, pendencias de pedidos e ocupacao atual de cada caminhao."
        title="Painel operacional"
      />

      <div className={styles.kpiGrid}>
        <MetricCard
          accent="VOL"
          helper={`${summary.pendingLiters.toLocaleString("pt-BR")} L ainda sem encaixe`}
          label="Volume carregado"
          value={formatCompactLiters(summary.totalLoadedLiters)}
        />
        <MetricCard
          accent="PED"
          helper={`${summary.partialOrders.length} pedido(s) parcialmente atendido(s)`}
          label="Pedidos pendentes"
          value={String(summary.pendingOrders.length + summary.partialOrders.length)}
        />
        <MetricCard
          accent="FRT"
          helper={`${formatLiters(summary.totalRemainingLiters)} livres na frota`}
          label="Uso da frota"
          value={formatPercent(summary.utilizationPercentage)}
        />
        <MetricCard
          accent="OK"
          helper={`${summary.allocatedOrders.length} pedido(s) totalmente encaixado(s)`}
          label="Pedidos alocados"
          value={String(summary.allocatedOrders.length)}
        />
      </div>

      <div className={styles.twoColumnGrid}>
        <Card subtitle="Volume total, saldo e ocupacao por caminhao." title="Ocupacao da frota">
          <div className={styles.listStack}>
            {summary.truckStates.map((truckState) => (
              <div className={styles.summaryRow} key={truckState.truck.id}>
                <div className={styles.summaryRowHeader}>
                  <div>
                    <p className={styles.rowTitle}>{truckState.truck.name}</p>
                    <p className={styles.rowSubtitle}>{truckState.truck.identifier}</p>
                  </div>
                  <StatusBadge tone={truckState.remainingLiters > 0 ? "success" : "warning"}>
                    {formatLiters(truckState.remainingLiters)} livres
                  </StatusBadge>
                </div>
                <ProgressBar value={truckState.utilizationPercentage} />
                <div className={styles.metaRow}>
                  <span>{formatLiters(truckState.loadedLiters)} carregados</span>
                  <span>{formatLiters(truckState.truck.totalCapacityLiters)} total</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card subtitle="Pedidos com volume restante para montar." title="Fila de pedidos">
          {summary.orderStates.filter((orderState) => orderState.remainingLiters > 0).length === 0 ? (
            <EmptyState text="Todos os pedidos cadastrados ja estao totalmente alocados." title="Fila vazia" />
          ) : (
            <div className={styles.listStack}>
              {summary.orderStates
                .filter((orderState) => orderState.remainingLiters > 0)
                .slice(0, 5)
                .map((orderState) => (
                  <div className={styles.summaryRow} key={orderState.order.id}>
                    <div className={styles.summaryRowHeader}>
                      <div>
                        <p className={styles.rowTitle}>
                          {orderState.order.code} | {orderState.order.customer}
                        </p>
                        <p className={styles.rowSubtitle}>
                          {formatLiters(orderState.allocatedLiters)} alocados de {formatLiters(orderState.order.liters)}
                        </p>
                      </div>
                      <StatusBadge tone={orderState.status === "pending" ? "error" : "warning"}>
                        {formatLiters(orderState.remainingLiters)} pendentes
                      </StatusBadge>
                    </div>
                    <ProgressBar value={orderState.fillPercentage} />
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      <div className={styles.twoColumnGrid}>
        <Card subtitle="Distribuicao do volume efetivamente carregado." title="Mix por combustivel">
          <div className={styles.listStack}>
            {loadedByFuel.map((fuel) => {
              const percentage = summary.totalLoadedLiters > 0 ? (fuel.liters / summary.totalLoadedLiters) * 100 : 0;

              return (
                <div className={styles.summaryRow} key={fuel.id}>
                  <div className={styles.summaryRowHeader}>
                    <p className={styles.rowTitle}>{fuel.label}</p>
                    <p className={styles.rowTitle}>{formatLiters(fuel.liters)}</p>
                  </div>
                  <ProgressBar color={fuel.color} value={percentage} />
                  <div className={styles.metaRow}>
                    <span>{formatPercent(percentage)} do volume atual</span>
                    <span>{fuel.shortLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card subtitle="Pontos que merecem atencao no planejamento do dia." title="Alertas operacionais">
          {alerts.length === 0 ? (
            <EmptyState text="Nenhuma restricao ou pendencia relevante no momento." title="Operacao estavel" />
          ) : (
            <div className={styles.listStack}>
              {alerts.map((alert) => (
                <div className={styles.alertCard} key={alert.id}>
                  <div className={styles.summaryRowHeader}>
                    <p className={styles.rowTitle}>{alert.title}</p>
                    <StatusBadge tone={alert.tone}>{alert.tone}</StatusBadge>
                  </div>
                  <p className={styles.rowSubtitle}>{alert.description}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
