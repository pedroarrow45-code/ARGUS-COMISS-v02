import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { calculateStockCommission } from "../../src/features/commission-dashboard/engine/calculate-stock-commission";
import { CURRENT_COMMISSION_RULES } from "../../src/features/commission-dashboard/engine/calculate-commission";

describe("potencialização operacional da comissão-base manual de estoque", () => {
  for (const scenario of [
    { name: "venda zero", sold: 0, goal: 1000, ratio: 0, multiplier: 1, total: 100 },
    { name: "abaixo de 105%", sold: 1000, goal: 1000, ratio: 1, multiplier: 1, total: 100 },
    { name: "exatamente 105%", sold: 1050, goal: 1000, ratio: 1.05, multiplier: 1.15, total: 115 },
    { name: "entre 105% e 135%", sold: 1200, goal: 1000, ratio: 1.2, multiplier: 1.15, total: 115 },
    { name: "exatamente 135%", sold: 1350, goal: 1000, ratio: 1.35, multiplier: 1.25, total: 125 },
    { name: "acima de 135%", sold: 1500, goal: 1000, ratio: 1.5, multiplier: 1.25, total: 125 },
    { name: "meta nula", sold: 1500, goal: null, ratio: 0, multiplier: 1, total: 100 },
    { name: "meta zero", sold: 1500, goal: 0, ratio: 0, multiplier: 1, total: 100 },
  ]) {
    test(scenario.name, () => {
      const result = calculateStockCommission({ vendaEstoque: scenario.sold, metaEstoque: scenario.goal, comissaoEstoqueBase: 100 }, CURRENT_COMMISSION_RULES);
      assert.deepEqual(result, { percentualAtingido: scenario.ratio, multiplicadorEstoque: scenario.multiplier, comissaoEstoqueFinal: scenario.total });
    });
  }

  test("comissão-base zero permanece zero mesmo em Zona Azul", () => {
    const result = calculateStockCommission({ vendaEstoque: 1500, metaEstoque: 1000, comissaoEstoqueBase: 0 }, CURRENT_COMMISSION_RULES);
    assert.equal(result.multiplicadorEstoque, 1.25);
    assert.equal(result.comissaoEstoqueFinal, 0);
  });

  test("meta de estoque não recebe redução implícita para experiência", () => {
    const result = calculateStockCommission({ vendaEstoque: 700, metaEstoque: 1000, comissaoEstoqueBase: 100 }, CURRENT_COMMISSION_RULES);
    assert.equal(result.percentualAtingido, 0.7);
    assert.equal(result.multiplicadorEstoque, 1);
    assert.equal(result.comissaoEstoqueFinal, 100);
  });
});
