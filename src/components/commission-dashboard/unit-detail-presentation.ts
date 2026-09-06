import type { CommissionRules, CommissionZone } from "@/features/commission-dashboard/engine/calculate-commission";

export type ZonePresentation = {
  state: "NOT_MET" | CommissionZone;
  label: string;
  tone: "red" | "gray" | "green" | "navy";
};

export const UNIT_DETAIL_COLUMNS = [
  "Funcionário", "Status", "Abastecimento", "Tipo", "Turno",
  "Meta L", "Vendido L", "% Litros", "Zona Litros",
  "Meta Est.", "Venda Est.", "% Estoque", "Zona Estoque", "Com. Est.",
  "Com. Litros", "Dobras", "Bônus", "Total",
] as const;

export const UNIT_DETAIL_GROUP_STARTS = new Set(["Meta L", "Meta Est.", "Com. Litros"]);

export const UNIT_DETAIL_COLUMN_WIDTHS = [
  220, 110, 120, 115, 90,
  135, 140, 110, 115,
  140, 140, 110, 115, 130,
  130, 95, 120, 140,
] as const;

export function getDisplayedFinalCommission(input: {
  persistedFinalTotalCommission: number | null;
  previewFinalTotalCommission?: number | null;
}) {
  return input.previewFinalTotalCommission ?? input.persistedFinalTotalCommission;
}

export function getZonePresentation(
  achievementPercentage: number,
  zone: CommissionZone,
  zones: CommissionRules["zones"],
): ZonePresentation {
  if (achievementPercentage < 100) {
    return { state: "NOT_MET", label: "Não atingiu", tone: "red" };
  }

  if (zone === "BLUE") return { state: zone, label: `Azul (${zones.blueMultiplier.toFixed(2)})`, tone: "navy" };
  if (zone === "GREEN") return { state: zone, label: `Verde (${zones.greenMultiplier.toFixed(2)})`, tone: "green" };
  return { state: zone, label: `Neutra (${zones.neutralMultiplier.toFixed(2)})`, tone: "gray" };
}
