import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CURRENT_COMMISSION_RULES } from "../../src/features/commission-dashboard/engine/calculate-commission";
import { calculateUnitCommissions } from "../../src/features/commission-dashboard/engine/calculate-commissions";
import type { EmployeeRecordInput } from "../../src/features/commission-dashboard/engine/types";

const round2 = (value: number) => Math.round(value * 100) / 100;

const profiles = [
  { name: "efetivado diurno", employmentType: "PERMANENT", shift: "DAYTIME", rate: 0.01, goal: 1000 },
  { name: "efetivado noturno", employmentType: "PERMANENT", shift: "NIGHTTIME", rate: 0.03, goal: 1000 },
  { name: "experiência diurno", employmentType: "PROBATION", shift: "DAYTIME", rate: 0.0075, goal: 1000 },
  { name: "experiência noturno", employmentType: "PROBATION", shift: "NIGHTTIME", rate: 0.02, goal: 1000 },
] as const;

const bands = [
  { name: "abaixo de 105%", pct: 100, multiplier: 1 },
  { name: "exatamente 105%", pct: 105, multiplier: 1.15 },
  { name: "entre 105% e 135%", pct: 120, multiplier: 1.15 },
  { name: "exatamente 135%", pct: 135, multiplier: 1.25 },
  { name: "acima de 135%", pct: 150, multiplier: 1.25 },
] as const;

function calculate(employee: EmployeeRecordInput, unitGoalLiters = 1_000_000, unitSoldLiters = employee.soldLiters) {
  return calculateUnitCommissions({ unitGoalLiters, unitSoldLiters, employees: [employee] }, CURRENT_COMMISSION_RULES);
}

describe("matriz operacional de taxas, experiência e zonas de litragem", () => {
  for (const profile of profiles) {
    for (const band of bands) {
      test(`${profile.name}: ${band.name}`, () => {
        const effectiveGoal = profile.goal;
        const soldLiters = effectiveGoal * (band.pct / 100);
        const result = calculate({
          employeeId: profile.name,
          employmentType: profile.employmentType,
          shift: profile.shift,
          baseGoalLiters: profile.employmentType === "PROBATION" ? profile.goal / 0.7 : profile.goal,
          soldLiters,
        });
        const employee = result.employees[0];
        const base = round2(soldLiters * profile.rate);
        const potentialized = round2(base * band.multiplier);

        assert.equal(employee.completionPercent, band.pct);
        assert.equal(employee.baseRate, profile.rate);
        assert.equal(employee.baseCommission, base);
        assert.equal(employee.litersMultiplier, band.multiplier);
        assert.equal(employee.bonusApplied, false);
        assert.equal(employee.bonusAmount, 0);
        assert.equal(employee.totalCommission, round2(potentialized * 0.8));
        assert.equal(result.bonusUnlocked, false);
      });
    }
  }
});

describe("limites e arredondamento atuais da litragem", () => {
  for (const boundary of [
    { name: "imediatamente abaixo de 105%", sold: 1049.94, pct: 104.99, multiplier: 1 },
    { name: "exatamente 105%", sold: 1050, pct: 105, multiplier: 1.15 },
    { name: "imediatamente acima de 105%", sold: 1050.01, pct: 105, multiplier: 1.15 },
    { name: "imediatamente abaixo de 135%", sold: 1349.94, pct: 134.99, multiplier: 1.15 },
    { name: "exatamente 135%", sold: 1350, pct: 135, multiplier: 1.25 },
    { name: "imediatamente acima de 135%", sold: 1350.01, pct: 135, multiplier: 1.25 },
  ]) {
    test(boundary.name, () => {
      const employee = calculate({ employeeId: "boundary", employmentType: "PERMANENT", shift: "DAYTIME", baseGoalLiters: 1000, soldLiters: boundary.sold }).employees[0];
      assert.equal(employee.completionPercent, boundary.pct);
      assert.equal(employee.litersMultiplier, boundary.multiplier);
    });
  }

  test("meta zero torna o funcionário inelegível", () => {
    const employee = calculate({ employeeId: "zero", employmentType: "PERMANENT", shift: "DAYTIME", baseGoalLiters: 0, soldLiters: 500 }).employees[0];
    assert.equal(employee.completionPercent, 0);
    assert.equal(employee.metIndividualGoal, false);
    assert.equal(employee.eligible, false);
    assert.equal(employee.baseCommission, 0);
    assert.equal(employee.totalCommission, 0);
  });

  test("meta negativa torna o funcionário inelegível", () => {
    const employee = calculate({ employeeId: "negative", employmentType: "PERMANENT", shift: "DAYTIME", baseGoalLiters: -100, soldLiters: 500 }).employees[0];
    assert.equal(employee.completionPercent, 0);
    assert.equal(employee.metIndividualGoal, false);
    assert.equal(employee.eligible, false);
    assert.equal(employee.totalCommission, 0);
  });

  test("arredonda fração de centavo na comissão-base antes de potencializar", () => {
    const employee = calculate({ employeeId: "cents", employmentType: "PROBATION", shift: "DAYTIME", baseGoalLiters: 1333 / 0.7, soldLiters: 1333 }).employees[0];
    assert.equal(employee.baseCommission, 10);
    assert.equal(employee.litersMultiplier, 1);
    assert.equal(employee.totalCommission, 8);
  });

  test("usa a meta final fracionária sem aplicar novamente o fator de experiência", () => {
    const employee = calculate({ employeeId: "fractional-goal", employmentType: "PROBATION", shift: "DAYTIME", baseGoalLiters: 1000.01 / 0.7, soldLiters: 1000.01 }).employees[0];
    assert.equal(employee.completionPercent, 100);
    assert.equal(employee.metIndividualGoal, true);
  });
});

describe("bônus coletivo operacional", () => {
  for (const scenario of [
    { name: "soma individual abaixo da meta", goal: 1001, sold: 1000, bonus: false },
    { name: "soma individual exatamente na meta", goal: 1000, sold: 1000, bonus: true },
    { name: "soma individual acima da meta", goal: 999, sold: 1000, bonus: true },
    { name: "meta coletiva zero", goal: 0, sold: 1000, bonus: false },
  ]) {
    test(scenario.name, () => {
      const result = calculate({ employeeId: "bonus", employmentType: "PERMANENT", shift: "DAYTIME", baseGoalLiters: 1000, soldLiters: scenario.sold }, scenario.goal, scenario.sold);
      const employee = result.employees[0];
      const potentialized = round2(employee.baseCommission * employee.litersMultiplier);
      assert.equal(result.unitMetGoal, scenario.bonus);
      assert.equal(employee.bonusApplied, scenario.bonus);
      const grossBonus = scenario.bonus ? round2(potentialized * 0.05) : 0;
      assert.equal(employee.bonusAmount, round2(grossBonus * 0.8));
      assert.equal(employee.totalCommission, round2(potentialized * 0.8 + employee.bonusAmount));
    });
  }

  test("usa o total de litros fornecido pela unidade, não metas financeiras ou de estoque", () => {
    const result = calculate({ employeeId: "only-liters", employmentType: "PERMANENT", shift: "DAYTIME", baseGoalLiters: 1000, soldLiters: 1500 }, 2000, 1500);
    assert.equal(result.bonusUnlocked, false);
    assert.equal(result.employees[0].bonusAmount, 0);
  });
});
