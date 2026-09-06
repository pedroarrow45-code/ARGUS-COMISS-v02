import { calculateStockBreakdown, getStockZoneFromAchievement } from "./calculate-commission";
import type { CommissionRules } from "./calculate-commission";

export type StockCommissionInput = {
  /** Valor de venda de estoque em R$ */
  vendaEstoque: number | null | undefined;
  /** Meta de venda de estoque em R$ */
  metaEstoque: number | null | undefined;
  /** Comissão de estoque base (valor bruto em R$) */
  comissaoEstoqueBase: number;
};

export type StockCommissionResult = {
  /** Razão base / meta (0 quando meta é inválida) */
  percentualAtingido: number;
  /** Multiplicador automático (1.00 | 1.15 | 1.25) */
  multiplicadorEstoque: number;
  /** comissaoEstoqueBase × multiplicadorEstoque */
  comissaoEstoqueFinal: number;
};

/** Adaptador público mantido para os consumidores existentes. */
export function getStockMultiplier(percentualAtingido: number, rules: CommissionRules): number {
  return getStockZoneFromAchievement(percentualAtingido, rules).multiplier;
}

/** Adaptador público mantido; a regra pertence ao motor calculateCommission. */
export function calculateStockCommission(input: StockCommissionInput, rules: CommissionRules): StockCommissionResult {
  const result = calculateStockBreakdown({
    soldStock: input.vendaEstoque,
    stockGoal: input.metaEstoque,
    stockBaseCommission: input.comissaoEstoqueBase,
  }, rules);

  return {
    percentualAtingido: result.stockAchievement,
    multiplicadorEstoque: result.stockMultiplier,
    comissaoEstoqueFinal: result.stockFinalCommission,
  };
}
