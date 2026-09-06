import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CURRENT_COMMISSION_RULES } from "../../src/features/commission-dashboard/engine/calculate-commission";
import { resolveGoalDisplaySnapshot } from "../../src/features/commission-dashboard/engine/commission-display-snapshot";

const snapshot = (overrides: Record<string, unknown> = {}) => resolveGoalDisplaySnapshot({
  employmentType: "PROBATION",
  rules: CURRENT_COMMISSION_RULES,
  closed: true,
  baseGoalLiters: 33_000,
  effectiveGoalLiters: 23_100,
  soldLiters: 33_877.994,
  baseStockGoal: 2_300,
  effectiveStockGoal: 1_610,
  legacyStockGoal: 2_300,
  soldStock: 1_610,
  ...overrides,
} as Parameters<typeof resolveGoalDisplaySnapshot>[0]);

describe("snapshot único para Metas e Relatórios", () => {
  test("Rafael usa 23.100 como denominador e retorna 146,7% / Azul", () => {
    const result = snapshot();
    assert.equal(result.effectiveGoalLiters, 23_100);
    assert.ok(Math.abs(result.achievementPercentage - 146.658) < 0.001);
    assert.equal(result.litersZone, "BLUE");
  });

  test("não reconstrói nem propaga base ausente a partir do snapshot efetivo", () => {
    assert.equal(snapshot({ effectiveGoalLiters: 0 }).effectiveGoalLiters, 23_100);
    assert.equal(snapshot({ baseGoalLiters: 0 }).baseGoalLiters, 0);
    assert.equal(snapshot({ baseGoalLiters: 0 }).effectiveGoalLiters, 0);
    assert.deepEqual(
      { base: snapshot().baseGoalLiters, effective: snapshot().effectiveGoalLiters },
      { base: 33_000, effective: 23_100 },
    );
    assert.deepEqual(
      { base: snapshot({ baseGoalLiters: 0, effectiveGoalLiters: 0 }).baseGoalLiters, effective: snapshot({ baseGoalLiters: 0, effectiveGoalLiters: 0 }).effectiveGoalLiters },
      { base: 0, effective: 0 },
    );
  });

  for (const stock of [
    { sold: 1_610, pct: 100, zone: "NEUTRAL" },
    { sold: 1_690.5, pct: 105, zone: "GREEN" },
    { sold: 2_173.5, pct: 135, zone: "BLUE" },
  ] as const) {
    test(`estoque de experiência: ${stock.pct}%`, () => {
      const result = snapshot({ soldStock: stock.sold });
      assert.equal(result.effectiveStockGoal, 1_610);
      assert.equal(result.stockAchievementPercentage, stock.pct);
      assert.equal(result.stockZone, stock.zone);
    });
  }
});
