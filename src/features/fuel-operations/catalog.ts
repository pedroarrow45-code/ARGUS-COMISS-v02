import type { AppTab, FuelType } from "./types";

export const APP_TABS: Array<{ id: AppTab; label: string }> = [
  { id: "dashboard", label: "Painel" },
  { id: "trucks", label: "Caminhoes" },
  { id: "orders", label: "Pedidos" },
  { id: "planning", label: "Montagem de carga" },
  { id: "summary", label: "Resumo" },
];

export const FUEL_OPTIONS: Array<{ id: FuelType; label: string; shortLabel: string; color: string }> = [
  { id: "gasolina_c", label: "Gasolina C", shortLabel: "GC", color: "#f59e0b" },
  { id: "gasolina_aditivada", label: "Gasolina Aditivada", shortLabel: "GA", color: "#ef4444" },
  { id: "etanol", label: "Etanol", shortLabel: "ET", color: "#22c55e" },
  { id: "diesel_s10", label: "Diesel S-10", shortLabel: "D10", color: "#3b82f6" },
  { id: "diesel_s500", label: "Diesel S-500", shortLabel: "D500", color: "#8b5cf6" },
];

export const FUEL_MAP = Object.fromEntries(FUEL_OPTIONS.map((fuel) => [fuel.id, fuel])) as Record<
  FuelType,
  (typeof FUEL_OPTIONS)[number]
>;
