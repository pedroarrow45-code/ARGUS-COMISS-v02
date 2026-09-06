"use client";

import { FUEL_MAP } from "../catalog";
import { formatDateTime, formatLiters } from "../format";
import { getOrderLoadState } from "../selectors";
import { useFuelOperationsStore } from "../store";
import type { Allocation, Order } from "../types";
import styles from "./fuel-operations.module.css";
import { Card, EmptyState, ProgressBar, SectionLead, StatusBadge } from "./shared";
import { OrderForm } from "./order-form";

export function OrdersTab({
  orders,
  allocations,
}: {
  orders: Order[];
  allocations: Allocation[];
}) {
  const { createOrder, applySuggestedAllocation } = useFuelOperationsStore();
  const orderStates = orders.map((order) => getOrderLoadState(order, allocations));

  return (
    <div className={styles.viewStack}>
      <SectionLead
        text="Cadastro de pedidos reais por cliente, combustivel e volume em litros."
        title="Pedidos"
      />

      <div className={styles.twoColumnGrid}>
        <Card subtitle="Formulario simples para registrar novas demandas do dia." title="Novo pedido">
          <OrderForm onSubmit={createOrder} />
        </Card>

        <Card subtitle="Leitura rapida para quem esta montando as cargas." title="Resumo da fila">
          <div className={styles.listStack}>
            <div className={styles.summaryRow}>
              <div className={styles.summaryRowHeader}>
                <p className={styles.rowTitle}>Pedidos pendentes ou parciais</p>
                <StatusBadge tone="warning">
                  {orderStates.filter((orderState) => orderState.remainingLiters > 0).length}
                </StatusBadge>
              </div>
              <p className={styles.rowSubtitle}>
                {formatLiters(orderStates.reduce((total, orderState) => total + orderState.remainingLiters, 0))} ainda sem encaixe.
              </p>
            </div>
            <div className={styles.summaryRow}>
              <div className={styles.summaryRowHeader}>
                <p className={styles.rowTitle}>Pedidos totalmente alocados</p>
                <StatusBadge tone="success">
                  {orderStates.filter((orderState) => orderState.status === "allocated").length}
                </StatusBadge>
              </div>
              <p className={styles.rowSubtitle}>Os pedidos encerrados seguem disponiveis para conferencia no resumo.</p>
            </div>
          </div>
        </Card>
      </div>

      <Card subtitle="Acompanhamento de status, litros alocados e saldo restante." title="Carteira de pedidos">
        {orderStates.length === 0 ? (
          <EmptyState text="Nenhum pedido cadastrado ainda." title="Sem pedidos" />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Combustivel</th>
                  <th>Litros</th>
                  <th>Status</th>
                  <th>Andamento</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {orderStates.map((orderState) => (
                  <tr key={orderState.order.id}>
                    <td>
                      <p className={styles.cellTitle}>{orderState.order.code}</p>
                      <p className={styles.cellSubtitle}>{orderState.order.customer}</p>
                      <p className={styles.cellSubtitle}>{formatDateTime(orderState.order.createdAt)}</p>
                    </td>
                    <td>{FUEL_MAP[orderState.order.fuelType].label}</td>
                    <td>
                      <p className={styles.cellTitle}>{formatLiters(orderState.order.liters)}</p>
                      <p className={styles.cellSubtitle}>{formatLiters(orderState.remainingLiters)} pendentes</p>
                    </td>
                    <td>
                      <StatusBadge
                        tone={
                          orderState.status === "allocated"
                            ? "success"
                            : orderState.status === "partial"
                              ? "warning"
                              : "error"
                        }
                      >
                        {orderState.status === "allocated"
                          ? "Alocado"
                          : orderState.status === "partial"
                            ? "Parcial"
                            : "Pendente"}
                      </StatusBadge>
                    </td>
                    <td className={styles.tableProgressCell}>
                      <ProgressBar color={FUEL_MAP[orderState.order.fuelType].color} value={orderState.fillPercentage} />
                      <span className={styles.helperText}>
                        {formatLiters(orderState.allocatedLiters)} de {formatLiters(orderState.order.liters)}
                      </span>
                    </td>
                    <td>
                      {orderState.remainingLiters > 0 ? (
                        <button
                          className={styles.secondaryButton}
                          onClick={() => applySuggestedAllocation(orderState.order.id)}
                          type="button"
                        >
                          Aplicar sugestao
                        </button>
                      ) : (
                        <span className={styles.cellSubtitle}>Sem acoes</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
