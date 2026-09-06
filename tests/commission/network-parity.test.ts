import assert from "node:assert/strict";
import { test } from "node:test";

import { auditCommissionRecord } from "../../src/features/commission-dashboard/engine/audit-commission-record";
import { calculateCommission, CURRENT_COMMISSION_RULES } from "../../src/features/commission-dashboard/engine/calculate-commission";

const fixtures = [
  { unit: "GOIAS NORTE", type: "PERMANENT", shift: "DAYTIME", base: 10_000, sold: 9_999.99, stock: 10_000 },
  { unit: "ESMERALDAS", type: "PROBATION", shift: "DAYTIME", base: 33_000, sold: 33_877.994, stock: 1_610 },
  { unit: "UNIDADE CENTRO", type: "PERMANENT", shift: "NIGHTTIME", base: 10_000, sold: 10_500, stock: 9_999.99 },
  { unit: "UNIDADE SUL", type: "PROBATION", shift: "NIGHTTIME", base: 10_000, sold: 9_450, stock: 6_999.99 },
] as const;

test("paridade sistêmica em múltiplas unidades, vínculos, turnos, zonas e matriz 80%", () => {
  for (const fixture of fixtures) {
    const employmentType = fixture.type;
    const employeeShift = fixture.shift;
    const direct = calculateCommission({
      employmentType, employeeShift, baseGoalLiters: fixture.base, soldLiters: fixture.sold,
      unitMetLitersGoal: true, soldStock: fixture.stock, stockGoal: 10_000,
      stockBaseCommission: 100, dobras: 0,
    }, CURRENT_COMMISSION_RULES);
    const audit = auditCommissionRecord({
      employeeId: fixture.unit, employeeName: fixture.unit, employmentType, employeeShift,
      baseGoalLiters: fixture.base, finalGoalLiters: direct.effectiveGoalLiters, soldLiters: fixture.sold,
      stockGoalCommission: 10_000, baseStockGoal: 10_000, effectiveStockGoal: direct.effectiveStockGoal,
      soldStock: fixture.stock, stockCommission: 100, dobras: 0,
      litersMultiplier: direct.litersMultiplier, stockMultiplier: direct.stockMultiplier,
      bonusAmount: direct.bonusAmount, totalCommission: direct.totalCommission,
      finalTotalCommission: direct.finalTotalCommission,
    }, CURRENT_COMMISSION_RULES, true);
    assert.equal(audit.historical.effectiveGoalLiters, direct.effectiveGoalLiters, fixture.unit);
    assert.equal(Math.round(audit.historical.achievementPercentage * 100) / 100, direct.achievementPercentage, fixture.unit);
    assert.equal(audit.historical.litersZone, direct.litersZone, fixture.unit);
    assert.equal(audit.expected.effectiveStockGoal, direct.effectiveStockGoal, fixture.unit);
    assert.equal(audit.expected.stockZone, direct.stockZone, fixture.unit);
    assert.equal(audit.expected.litersFactor, direct.litersFactor, fixture.unit);
    assert.equal(audit.expected.stockFactor, direct.stockFactor, fixture.unit);
    assert.equal(audit.expected.bonusAmount, direct.bonusAmount, fixture.unit);
    assert.equal(audit.expected.finalTotalCommission, direct.finalTotalCommission, fixture.unit);
    assert.equal(audit.classification, "OK", fixture.unit);
  }
});
