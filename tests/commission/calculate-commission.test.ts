import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { calculateCommission, CURRENT_COMMISSION_RULES, roundCommission } from "../../src/features/commission-dashboard/engine/calculate-commission";
import type { CommissionCalculationInput } from "../../src/features/commission-dashboard/engine/calculate-commission";

function input(overrides: Partial<CommissionCalculationInput> = {}): CommissionCalculationInput {
  return {
    employmentType: "PERMANENT",
    employeeShift: "DAYTIME",
    baseGoalLiters: 1000,
    soldLiters: 1000,
    unitMetLitersGoal: false,
    soldStock: 1,
    stockGoal: 1,
    stockBaseCommission: 0,
    dobras: 0,
    ...overrides,
  };
}

const calculateCurrent = (value: CommissionCalculationInput) => calculateCommission(value, CURRENT_COMMISSION_RULES);

describe("calculateCommission: fonte central do fechamento operacional", () => {
  for (const scenario of [
    { name: "duas metas", soldLiters: 1000, soldStock: 1000, litersFactor: 1, stockFactor: 1, liters: 10, stock: 100, total: 110 },
    { name: "somente litragem", soldLiters: 1000, soldStock: 999, litersFactor: 0.8, stockFactor: 0, liters: 8, stock: 0, total: 8 },
    { name: "somente estoque", soldLiters: 999, soldStock: 1000, litersFactor: 0, stockFactor: 0.8, liters: 0, stock: 80, total: 80 },
    { name: "nenhuma meta", soldLiters: 999, soldStock: 999, litersFactor: 0, stockFactor: 0, liters: 0, stock: 0, total: 0 },
  ] as const) {
    test(`aplica a matriz cruzada uma única vez: ${scenario.name}`, () => {
      const result = calculateCurrent(input({
        soldLiters: scenario.soldLiters,
        soldStock: scenario.soldStock,
        stockGoal: 1000,
        stockBaseCommission: 100,
      }));
      assert.equal(result.hitLitersTarget, scenario.soldLiters >= 1000);
      assert.equal(result.hitStockTarget, scenario.soldStock >= 1000);
      assert.equal(result.litersFactor, scenario.litersFactor);
      assert.equal(result.stockFactor, scenario.stockFactor);
      assert.equal(result.totalCommission, scenario.liters);
      assert.equal(result.stockFinalCommission, scenario.stock);
      assert.equal(result.finalTotalCommission, scenario.total);
    });
  }

  for (const profile of [
    { name: "efetivado diurno", employmentType: "PERMANENT", employeeShift: "DAYTIME", rate: 0.01 },
    { name: "efetivado noturno", employmentType: "PERMANENT", employeeShift: "NIGHTTIME", rate: 0.03 },
    { name: "experiência diurno", employmentType: "PROBATION", employeeShift: "DAYTIME", rate: 0.0075 },
    { name: "experiência noturno", employmentType: "PROBATION", employeeShift: "NIGHTTIME", rate: 0.02 },
  ] as const) {
    test(`aplica a taxa de ${profile.name}`, () => {
      const result = calculateCurrent(input({
        employmentType: profile.employmentType,
        employeeShift: profile.employeeShift,
        soldLiters: 1000,
      }));
      assert.equal(result.baseRate, profile.rate);
      assert.equal(result.effectiveGoalLiters, profile.employmentType === "PROBATION" ? 700 : 1000);
      assert.equal(result.baseRate, profile.rate);
    });
  }

  for (const zone of [
    { name: "neutra", soldLiters: 1000, multiplier: 1, value: "NEUTRAL" },
    { name: "Verde no limite de 105%", soldLiters: 1050, multiplier: 1.15, value: "GREEN" },
    { name: "Azul no limite de 135%", soldLiters: 1350, multiplier: 1.25, value: "BLUE" },
  ] as const) {
    test(`retorna breakdown explícito da zona ${zone.name}`, () => {
      const result = calculateCurrent(input({ soldLiters: zone.soldLiters }));
      assert.equal(result.litersMultiplier, zone.multiplier);
      assert.equal(result.litersZone, zone.value);
      assert.equal(result.achievementPercentage, zone.soldLiters / 10);
    });
  }

  test("aplica bônus de 5% somente sobre a litragem potencializada", () => {
    const result = calculateCurrent(input({ soldLiters: 1050, unitMetLitersGoal: true, stockBaseCommission: 100, dobras: 20 }));
    assert.equal(result.boostedLitersCommission, 12.08);
    assert.equal(result.bonusAmount, 0.6);
    assert.equal(result.totalCommission, 12.68);
    assert.equal(result.finalTotalCommission, 132.68);
  });

  test("potencializa a comissão-base manual de estoque", () => {
    const result = calculateCurrent(input({ soldStock: 1350, stockGoal: 1000, stockBaseCommission: 100 }));
    assert.equal(result.stockAchievement, 1.35);
    assert.equal(result.stockZone, "BLUE");
    assert.equal(result.stockMultiplier, 1.25);
    assert.equal(result.stockFinalCommission, 125);
  });

  test("reduz a meta de estoque para experiência", () => {
    const result = calculateCurrent(input({ employmentType: "PROBATION", soldLiters: 1000, soldStock: 700, stockGoal: 1000, stockBaseCommission: 100 }));
    assert.equal(result.effectiveGoalLiters, 700);
    assert.equal(result.effectiveStockGoal, 700);
    assert.equal(result.stockAchievement, 1);
    assert.equal(result.stockMultiplier, 1);
  });

  test("soma dobras por último no cenário completo caracterizado", () => {
    const result = calculateCurrent(input({
      baseGoalLiters: 10_000,
      soldLiters: 13_500,
      unitMetLitersGoal: true,
      soldStock: 1350,
      stockGoal: 1000,
      stockBaseCommission: 50,
      dobras: 20,
    }));
    assert.equal(result.baseCommission, 135);
    assert.equal(result.boostedLitersCommission, 168.75);
    assert.equal(result.bonusAmount, 8.44);
    assert.equal(result.totalCommission, 177.19);
    assert.equal(result.stockFinalCommission, 62.5);
    assert.equal(result.finalTotalCommission, 259.69);
  });

  test("mantém 1,00 imediatamente abaixo de 105% após arredondar o percentual", () => {
    const result = calculateCurrent(input({ soldLiters: 1049.94 }));
    assert.equal(result.achievementPercentage, 104.99);
    assert.equal(result.litersMultiplier, 1);
  });

  test("mantém Verde imediatamente abaixo de 135% após arredondar o percentual", () => {
    const result = calculateCurrent(input({ soldLiters: 1349.94 }));
    assert.equal(result.achievementPercentage, 134.99);
    assert.equal(result.litersMultiplier, 1.15);
  });
});

describe("meta aplicável de experiência", () => {
  for (const example of [
    { name: "Amanda", base: 24_000, sold: 25_225.281, effective: 16_800, percentage: 150.15, zone: "BLUE", multiplier: 1.25 },
    { name: "Ben Hur", base: 24_000, sold: 19_443.538, effective: 16_800, percentage: 115.74, zone: "GREEN", multiplier: 1.15 },
    { name: "Bruno Santos", base: 8_000, sold: 12_036.262, effective: 5_600, percentage: 214.93, zone: "BLUE", multiplier: 1.25 },
    { name: "Rafael Campos", base: 33_000, sold: 33_877.994, effective: 23_100, percentage: 146.66, zone: "BLUE", multiplier: 1.25 },
  ] as const) {
    test(`${example.name}: 70% é aplicado sobre a meta base antes da zona`, () => {
      const result = calculateCurrent(input({
        employmentType: "PROBATION",
        baseGoalLiters: example.base,
        soldLiters: example.sold,
      }));
      assert.equal(result.effectiveGoalLiters, example.effective);
      assert.equal(result.achievementPercentage, example.percentage);
      assert.equal(result.litersZone, example.zone);
      assert.equal(result.litersMultiplier, example.multiplier);
    });
  }

  test("estoque de experiência resolve 144,9% como Azul 1,25", () => {
    const result = calculateCurrent(input({
      employmentType: "PROBATION",
      baseGoalLiters: 1_000,
      soldLiters: 1_000,
      stockGoal: 2_000,
      soldStock: 2_029,
      stockBaseCommission: 100,
    }));
    assert.equal(result.effectiveStockGoal, 1_400);
    assert.equal(result.stockAchievement, 1.45);
    assert.equal(result.stockZone, "BLUE");
    assert.equal(result.stockMultiplier, 1.25);
  });

  for (const boundary of [
    { sold: 13_999.99, eligible: false, zone: "NEUTRAL", multiplier: 0 },
    { sold: 14_000, eligible: true, zone: "NEUTRAL", multiplier: 1 },
    { sold: 14_699.99, eligible: true, zone: "NEUTRAL", multiplier: 1 },
    { sold: 14_700, eligible: true, zone: "GREEN", multiplier: 1.15 },
    { sold: 18_899.99, eligible: true, zone: "GREEN", multiplier: 1.15 },
    { sold: 18_900, eligible: true, zone: "BLUE", multiplier: 1.25 },
  ] as const) {
    test(`litragem normal 20.000: resultado ${boundary.sold}`, () => {
      const result = calculateCurrent(input({ employmentType: "PROBATION", baseGoalLiters: 20_000, soldLiters: boundary.sold }));
      assert.equal(result.effectiveGoalLiters, 14_000);
      assert.equal(result.eligible, boundary.eligible);
      assert.equal(result.litersZone, boundary.zone);
      assert.equal(result.litersMultiplier, boundary.multiplier);
    });

    test(`estoque normal 20.000: resultado ${boundary.sold}`, () => {
      const result = calculateCurrent(input({ employmentType: "PROBATION", baseGoalLiters: 1, soldLiters: 1, stockGoal: 20_000, soldStock: boundary.sold, stockBaseCommission: 100 }));
      assert.equal(result.effectiveStockGoal, 14_000);
      assert.equal(result.stockCommissionEligible, boundary.eligible);
      assert.equal(result.stockZone, boundary.zone);
      if (boundary.eligible) assert.equal(result.stockMultiplier, boundary.multiplier);
    });
  }

  for (const profile of [
    { employmentType: "PERMANENT", employeeShift: "DAYTIME", rate: 0.01, factor: 1 },
    { employmentType: "PERMANENT", employeeShift: "NIGHTTIME", rate: 0.03, factor: 1 },
    { employmentType: "PROBATION", employeeShift: "DAYTIME", rate: 0.0075, factor: 0.7 },
    { employmentType: "PROBATION", employeeShift: "NIGHTTIME", rate: 0.02, factor: 0.7 },
  ] as const) {
    for (const scenario of [
      { liters: true, stock: true, litersFactor: 1, stockFactor: 1 },
      { liters: true, stock: false, litersFactor: 0.8, stockFactor: 0 },
      { liters: false, stock: true, litersFactor: 0, stockFactor: 0.8 },
      { liters: false, stock: false, litersFactor: 0, stockFactor: 0 },
    ]) {
      test(`matriz 80%: ${profile.employmentType}/${profile.employeeShift}/${scenario.liters}/${scenario.stock}`, () => {
        const applicable = 1000 * profile.factor;
        const result = calculateCurrent(input({
          employmentType: profile.employmentType,
          employeeShift: profile.employeeShift,
          baseGoalLiters: 1000,
          soldLiters: scenario.liters ? applicable : applicable - 0.01,
          stockGoal: 1000,
          soldStock: scenario.stock ? applicable : applicable - 0.01,
          stockBaseCommission: 100,
        }));
        assert.equal(result.baseRate, profile.rate);
        assert.equal(result.litersFactor, scenario.litersFactor);
        assert.equal(result.stockFactor, scenario.stockFactor);
        assert.equal(result.finalTotalCommission, roundCommission(applicable * profile.rate * scenario.litersFactor + 100 * scenario.stockFactor));
      });
    }
  }
});
