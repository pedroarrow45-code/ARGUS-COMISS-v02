"use client";

import { useEffect, useMemo, useState } from "react";

import { FUEL_MAP } from "../catalog";
import { formatLiters } from "../format";
import type { ActionResult, AllocationInput, OrderLoadState, TruckLoadState } from "../types";
import styles from "./fuel-operations.module.css";

export function ManualAllocationForm({
  orderStates,
  truckStates,
  onSubmit,
}: {
  orderStates: OrderLoadState[];
  truckStates: TruckLoadState[];
  onSubmit: (input: AllocationInput) => ActionResult;
}) {
  const availableOrders = useMemo(
    () => orderStates.filter((orderState) => orderState.remainingLiters > 0),
    [orderStates],
  );
  const [orderId, setOrderId] = useState("");
  const [truckId, setTruckId] = useState("");
  const [compartmentId, setCompartmentId] = useState("");
  const [liters, setLiters] = useState(0);

  useEffect(() => {
    if (!availableOrders.some((orderState) => orderState.order.id === orderId)) {
      setOrderId(availableOrders[0]?.order.id ?? "");
    }
  }, [availableOrders, orderId]);

  useEffect(() => {
    if (!truckStates.some((truckState) => truckState.truck.id === truckId)) {
      setTruckId(truckStates[0]?.truck.id ?? "");
    }
  }, [truckId, truckStates]);

  const selectedOrder = availableOrders.find((orderState) => orderState.order.id === orderId) ?? availableOrders[0];
  const selectedTruck = truckStates.find((truckState) => truckState.truck.id === truckId) ?? truckStates[0];
  const availableCompartments =
    selectedTruck?.compartments.filter(
      (compartment) =>
        compartment.remainingLiters > 0 &&
        (!compartment.fuelType || compartment.fuelType === selectedOrder?.order.fuelType),
    ) ?? [];

  useEffect(() => {
    if (!availableCompartments.some((compartment) => compartment.compartment.id === compartmentId)) {
      setCompartmentId(availableCompartments[0]?.compartment.id ?? "");
    }
  }, [availableCompartments, compartmentId]);

  const selectedCompartment =
    availableCompartments.find((compartment) => compartment.compartment.id === compartmentId) ?? availableCompartments[0];

  const maxLiters = Math.min(
    selectedOrder?.remainingLiters ?? 0,
    selectedTruck?.remainingLiters ?? 0,
    selectedCompartment?.remainingLiters ?? 0,
  );

  useEffect(() => {
    setLiters(maxLiters > 0 ? maxLiters : 0);
  }, [maxLiters, orderId, truckId, compartmentId]);

  function handleSubmit() {
    if (!selectedOrder || !selectedTruck || !selectedCompartment) {
      return;
    }

    onSubmit({
      orderId: selectedOrder.order.id,
      truckId: selectedTruck.truck.id,
      compartmentId: selectedCompartment.compartment.id,
      liters,
    });
  }

  return (
    <div className={styles.formStack}>
      <div className={styles.formGrid}>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Pedido</span>
          <select className={styles.select} onChange={(event) => setOrderId(event.currentTarget.value)} value={orderId}>
            {availableOrders.map((orderState) => (
              <option key={orderState.order.id} value={orderState.order.id}>
                {orderState.order.code} | {orderState.order.customer} | {formatLiters(orderState.remainingLiters)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Caminhao</span>
          <select className={styles.select} onChange={(event) => setTruckId(event.currentTarget.value)} value={truckId}>
            {truckStates.map((truckState) => (
              <option key={truckState.truck.id} value={truckState.truck.id}>
                {truckState.truck.name} | livre {formatLiters(truckState.remainingLiters)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Boca</span>
          <select
            className={styles.select}
            onChange={(event) => setCompartmentId(event.currentTarget.value)}
            value={compartmentId}
          >
            {availableCompartments.map((compartment) => (
              <option key={compartment.compartment.id} value={compartment.compartment.id}>
                {compartment.compartment.label} | livre {formatLiters(compartment.remainingLiters)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Litros para alocar</span>
          <input
            className={styles.input}
            max={maxLiters}
            min={0}
            onChange={(event) => setLiters(Number(event.currentTarget.value))}
            type="number"
            value={liters || ""}
          />
        </label>
      </div>

      {selectedOrder ? (
        <div className={styles.helperPanel}>
          <p className={styles.helperText}>
            Pedido selecionado: {selectedOrder.order.code} | {FUEL_MAP[selectedOrder.order.fuelType].label} | restante{" "}
            {formatLiters(selectedOrder.remainingLiters)}
          </p>
          <p className={styles.helperText}>
            Limite da alocacao atual: {formatLiters(maxLiters)} na {selectedCompartment?.compartment.label ?? "boca"}
          </p>
        </div>
      ) : null}

      <div className={styles.formActions}>
        <button
          className={styles.primaryButton}
          disabled={!selectedOrder || !selectedTruck || !selectedCompartment || maxLiters <= 0}
          onClick={handleSubmit}
          type="button"
        >
          Alocar manualmente
        </button>
      </div>
    </div>
  );
}
