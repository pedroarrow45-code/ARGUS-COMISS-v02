"use client";

import { useState } from "react";

import { FUEL_OPTIONS } from "../catalog";
import type { ActionResult, OrderFormInput } from "../types";
import styles from "./fuel-operations.module.css";

const initialDraft: OrderFormInput = {
  customer: "",
  fuelType: "gasolina_c",
  liters: 0,
};

export function OrderForm({
  onSubmit,
}: {
  onSubmit: (input: OrderFormInput) => ActionResult;
}) {
  const [draft, setDraft] = useState<OrderFormInput>(initialDraft);

  function handleSubmit() {
    const result = onSubmit(draft);

    if (result.tone !== "error") {
      setDraft(initialDraft);
    }
  }

  return (
    <div className={styles.formStack}>
      <div className={styles.formGrid}>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Cliente / unidade / posto</span>
          <input
            className={styles.input}
            onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, customer: event.currentTarget.value }))}
            placeholder="Ex.: Posto Centro"
            type="text"
            value={draft.customer}
          />
        </label>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Combustivel</span>
          <select
            className={styles.select}
            onChange={(event) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                fuelType: event.currentTarget.value as OrderFormInput["fuelType"],
              }))
            }
            value={draft.fuelType}
          >
            {FUEL_OPTIONS.map((fuel) => (
              <option key={fuel.id} value={fuel.id}>
                {fuel.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Litros</span>
          <input
            className={styles.input}
            min={0}
            onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, liters: Number(event.currentTarget.value) }))}
            type="number"
            value={draft.liters || ""}
          />
        </label>
      </div>
      <div className={styles.formActions}>
        <button className={styles.primaryButton} onClick={handleSubmit} type="button">
          Cadastrar pedido
        </button>
      </div>
    </div>
  );
}
