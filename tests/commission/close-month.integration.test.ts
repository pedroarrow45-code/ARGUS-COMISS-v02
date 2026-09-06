import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { closeMonth, reopenMonth } from "../../src/features/commission-dashboard/actions/close-month";

type RecordInput = {
  id: string;
  employeeId: string;
  employmentType: "PERMANENT" | "PROBATION";
  employeeShift: "DAYTIME" | "NIGHTTIME";
  baseGoalLiters: number;
  finalGoalLiters: number;
  soldLiters: number;
  soldStock: number | null;
  stockCommission: number | null;
  stockGoalCommission: number | null;
  baseStockGoal: number | null;
  effectiveStockGoal: number | null;
  dobras: number | null;
  employee: { status: "ACTIVE" | "INACTIVE"; unitId: string };
};

function configureCloseMonth({ records, unitGoalLiters, closedAt = null }: { records: RecordInput[]; unitGoalLiters: number; closedAt?: Date | null }) {
  const employeeUpdates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  const metricUpdates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  globalThis.__commissionRevalidatedPaths = [];
  globalThis.__commissionPrismaMock = {
    unitMonthlyMetric: {
      findUnique: async () => ({ id: "metric-1", goalLiters: unitGoalLiters, closedAt }),
      update: (args: { where: unknown; data: Record<string, unknown> }) => {
        metricUpdates.push(args);
        return Promise.resolve(args);
      },
    },
    employeeMonthlyRecord: {
      findMany: async () => records,
      update: (args: { where: unknown; data: Record<string, unknown> }) => {
        employeeUpdates.push(args);
        return Promise.resolve(args);
      },
      updateMany: async () => ({ count: records.length }),
    },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  };
  return { employeeUpdates, metricUpdates };
}

function record(overrides: Partial<RecordInput> = {}): RecordInput {
  return {
    id: "record-1",
    employeeId: "employee-1",
    employmentType: "PERMANENT",
    employeeShift: "DAYTIME",
    baseGoalLiters: 10_000,
    finalGoalLiters: 10_000,
    soldLiters: 10_000,
    soldStock: 1,
    stockCommission: null,
    stockGoalCommission: 1,
    baseStockGoal: null,
    effectiveStockGoal: null,
    dobras: null,
    employee: { status: "ACTIVE", unitId: "unit-1" },
    ...overrides,
  };
}

beforeEach(() => {
  delete globalThis.__commissionPrismaMock;
  delete globalThis.__commissionRevalidatedPaths;
});

describe("closeMonth: persistência do fechamento operacional", () => {
  test("persiste o breakdown completo e documenta totalCommission diferente do total oficial", async () => {
    const { employeeUpdates, metricUpdates } = configureCloseMonth({
      unitGoalLiters: 20_000,
      records: [record({ soldStock: 1000, stockGoalCommission: 1000, stockCommission: 50, dobras: 20 })],
    });

    assert.deepEqual(await closeMonth({ unitId: "unit-1", year: 2026, month: 8 }), { success: true });
    assert.equal(employeeUpdates.length, 1);
    assert.deepEqual(employeeUpdates[0].data, {
      baseRate: 0.01,
      commissionEligible: true,
      minimumEligibilityPercentage: 100,
      ineligibilityReason: null,
      baseCommission: 100,
      finalGoalLiters: 10_000,
      effectiveStockGoal: 1000,
      litersMultiplier: 1,
      bonusApplied: false,
      bonusAmount: 0,
      totalCommission: 100,
      stockMultiplier: 1,
      finalTotalCommission: 170,
    });
    assert.equal(metricUpdates.length, 1);
    assert.ok(metricUpdates[0].data.closedAt instanceof Date);
    assert.equal(metricUpdates[0].data.commissionRuleSetId, "00000000-0000-4000-8000-000000000001");
  });

  test("soma soldLiters individuais para liberar bônus e persiste 5% sobre litragem potencializada", async () => {
    const { employeeUpdates } = configureCloseMonth({
      unitGoalLiters: 2000,
      records: [record({ id: "r1", employeeId: "e1", baseGoalLiters: 1000, soldLiters: 1000 }), record({ id: "r2", employeeId: "e2", baseGoalLiters: 1000, soldLiters: 1000 })],
    });
    await closeMonth({ unitId: "unit-1", year: 2026, month: 8 });
    assert.equal(employeeUpdates.length, 2);
    for (const update of employeeUpdates) {
      assert.equal(update.data.bonusApplied, true);
      assert.equal(update.data.bonusAmount, 0.5);
      assert.equal(update.data.totalCommission, 10.5);
      assert.equal(update.data.finalTotalCommission, 10.5);
    }
  });

  test("experiência usa 70% da meta normal em litragem e estoque", async () => {
    const { employeeUpdates } = configureCloseMonth({
      unitGoalLiters: 10_000,
      records: [record({ employmentType: "PROBATION", baseGoalLiters: 1000, soldLiters: 1050, soldStock: 700, stockGoalCommission: 1000, stockCommission: 100 })],
    });
    await closeMonth({ unitId: "unit-1", year: 2026, month: 8 });
    assert.equal(employeeUpdates[0].data.finalGoalLiters, 700);
    assert.equal(employeeUpdates[0].data.litersMultiplier, 1.25);
    assert.equal(employeeUpdates[0].data.stockMultiplier, 1);
  });

  test("fechamento trata 70% da meta normal como 100% para experiência", async () => {
    const { employeeUpdates } = configureCloseMonth({
      unitGoalLiters: 100_000,
      records: [
        record({ id: "below", employeeId: "below", employmentType: "PROBATION", baseGoalLiters: 1000, soldLiters: 699.9, soldStock: 699.9, stockGoalCommission: 1000 }),
        record({ id: "boundary", employeeId: "boundary", employmentType: "PROBATION", baseGoalLiters: 1000, soldLiters: 700, soldStock: 700, stockGoalCommission: 1000 }),
      ],
    });
    await closeMonth({ unitId: "unit-1", year: 2026, month: 8 });
    assert.equal(employeeUpdates[0].data.commissionEligible, false);
    assert.equal(employeeUpdates[0].data.finalTotalCommission, 0);
    assert.equal(employeeUpdates[1].data.commissionEligible, true);
    assert.equal(employeeUpdates[1].data.minimumEligibilityPercentage, 100);
    assert.equal(employeeUpdates[1].data.totalCommission, 5.25);
  });

  test("persiste 80% do estoque quando somente a meta de estoque foi atingida", async () => {
    const percentages = [96.4, 88.8, 72.6, 80.7, 96, 86.5];
    const { employeeUpdates } = configureCloseMonth({
      unitGoalLiters: 1,
      records: percentages.map((percentage, index) => record({
        id: `r${index}`,
        employeeId: `e${index}`,
        soldLiters: 10_000 * percentage / 100,
        soldStock: 2000,
        stockGoalCommission: 1000,
        stockCommission: 100,
        dobras: 50,
      })),
    });
    await closeMonth({ unitId: "unit-1", year: 2026, month: 8 });
    for (const update of employeeUpdates) {
      assert.equal(update.data.commissionEligible, false);
      // 2.000 / 1.000 entra na Zona Azul: R$ 100 × 1,25 × 0,80.
      assert.equal(update.data.finalTotalCommission, 100);
    }
  });

  for (const scenario of [
    { name: "somente dobras abaixo do mínimo", row: record({ soldLiters: 0, dobras: 20 }), expected: 0 },
    { name: "litragem e dobras", row: record({ soldLiters: 10_000, dobras: 20 }), expected: 120 },
    { name: "estoque e dobras abaixo da meta de litros", row: record({ soldLiters: 0, soldStock: 1000, stockGoalCommission: 1000, stockCommission: 50, dobras: 20 }), expected: 40 },
    { name: "litragem, estoque e dobras", row: record({ soldLiters: 10_000, soldStock: 1000, stockGoalCommission: 1000, stockCommission: 50, dobras: 20 }), expected: 170 },
    { name: "litragem potencializada, bônus, estoque e dobras", row: record({ baseGoalLiters: 10_000, soldLiters: 13_500, soldStock: 1350, stockGoalCommission: 1000, stockCommission: 50, dobras: 20 }), expected: 259.69, unitGoal: 13_500 },
  ]) {
    test(`adiciona dobras por último: ${scenario.name}`, async () => {
      const { employeeUpdates } = configureCloseMonth({ unitGoalLiters: scenario.unitGoal ?? 1_000_000, records: [scenario.row] });
      await closeMonth({ unitId: "unit-1", year: 2026, month: 8 });
      assert.equal(employeeUpdates[0].data.finalTotalCommission, scenario.expected);
    });
  }

  test("estoque atingido não libera bônus quando a meta coletiva de litros não foi atingida", async () => {
    const { employeeUpdates } = configureCloseMonth({ unitGoalLiters: 20_000, records: [record({ soldStock: 1500, stockGoalCommission: 1000, stockCommission: 100 })] });
    await closeMonth({ unitId: "unit-1", year: 2026, month: 8 });
    assert.equal(employeeUpdates[0].data.stockMultiplier, 1.25);
    assert.equal(employeeUpdates[0].data.bonusApplied, false);
    assert.equal(employeeUpdates[0].data.bonusAmount, 0);
  });

  test("resultado financeiro não participa do bônus do fechamento operacional", async () => {
    const { employeeUpdates } = configureCloseMonth({ unitGoalLiters: 20_000, records: [record()] });
    // O mock representa uma métrica que poderia conter resultado financeiro atingido;
    // closeMonth seleciona e usa somente goalLiters para decidir o bônus.
    Object.assign(globalThis.__commissionPrismaMock.unitMonthlyMetric, { goalAmount: 1, resultAmount: 1_000_000 });
    await closeMonth({ unitId: "unit-1", year: 2026, month: 8 });
    assert.equal(employeeUpdates[0].data.bonusApplied, false);
    assert.equal(employeeUpdates[0].data.bonusAmount, 0);
  });

  test("funcionário inativo não recebe comissão nem altera atingimento coletivo", async () => {
    const { employeeUpdates } = configureCloseMonth({
      unitGoalLiters: 20_000,
      records: [
        record({ id: "active-record", employeeId: "active", soldLiters: 10_000 }),
        record({
          id: "inactive-record",
          employeeId: "inactive",
          soldLiters: 10_000,
          employee: { status: "INACTIVE", unitId: "unit-1" },
        }),
      ],
    });

    assert.deepEqual(await closeMonth({ unitId: "unit-1", year: 2026, month: 8 }), { success: true });
    assert.equal(employeeUpdates.length, 1);
    assert.equal((employeeUpdates[0].where as { id: string }).id, "active-record");
    assert.equal(employeeUpdates[0].data.bonusApplied, false);
  });

  test("rejeita novo fechamento quando o período já está fechado", async () => {
    const { employeeUpdates, metricUpdates } = configureCloseMonth({ unitGoalLiters: 1000, records: [record()], closedAt: new Date("2026-08-31T00:00:00Z") });
    assert.deepEqual(await closeMonth({ unitId: "unit-1", year: 2026, month: 8 }), { success: false, error: "Este período já foi fechado." });
    assert.equal(employeeUpdates.length, 0);
    assert.equal(metricUpdates.length, 0);
  });

  test("bloqueia fechamento que destruiria snapshot histórico sem meta base", async () => {
    const { employeeUpdates, metricUpdates } = configureCloseMonth({
      unitGoalLiters: 1000,
      records: [record({ baseGoalLiters: 0, finalGoalLiters: 700 })],
    });
    assert.deepEqual(await closeMonth({ unitId: "unit-1", year: 2026, month: 8 }), {
      success: false,
      error: "Existem metas históricas incompletas neste período. O fechamento foi bloqueado para evitar perda de dados.",
    });
    assert.equal(employeeUpdates.length, 0);
    assert.equal(metricUpdates.length, 0);
  });

  test("reopen limpa somente derivados e preserva todas as entradas e snapshots de meta", async () => {
    const row = record({ employmentType: "PROBATION", baseGoalLiters: 24_000, finalGoalLiters: 16_800 });
    const { employeeUpdates } = configureCloseMonth({ records: [row], unitGoalLiters: 24_000, closedAt: new Date() });
    let reopenData: Record<string, unknown> | undefined;
    globalThis.__commissionPrismaMock.employeeMonthlyRecord.updateMany = async ({ data }: { data: Record<string, unknown> }) => {
      reopenData = data;
      return { count: 1 };
    };

    assert.deepEqual(await reopenMonth({ unitId: "unit-1", year: 2026, month: 8 }), { success: true });
    assert.equal(employeeUpdates.length, 0);
    for (const input of ["baseGoalLiters", "finalGoalLiters", "baseStockGoal", "stockGoalCommission", "effectiveStockGoal", "soldLiters", "soldStock", "stockCommission", "dobras", "abastecimento", "periodStatus", "goalSource"]) {
      assert.equal(Object.hasOwn(reopenData ?? {}, input), false, `${input} não pode ser apagado no reopen`);
    }
  });

  test("close após reopen reaplica 70% uma única vez sobre a meta base", async () => {
    const row = record({ employmentType: "PROBATION", baseGoalLiters: 24_000, finalGoalLiters: 16_800, soldLiters: 16_800 });
    const first = configureCloseMonth({ records: [row], unitGoalLiters: 24_000 });
    assert.deepEqual(await closeMonth({ unitId: "unit-1", year: 2026, month: 8 }), { success: true });
    assert.equal(first.employeeUpdates[0].data.finalGoalLiters, 16_800);

    const second = configureCloseMonth({ records: [row], unitGoalLiters: 24_000 });
    assert.deepEqual(await closeMonth({ unitId: "unit-1", year: 2026, month: 8 }), { success: true });
    assert.equal(second.employeeUpdates[0].data.finalGoalLiters, 16_800);
    assert.notEqual(second.employeeUpdates[0].data.finalGoalLiters, 11_760);
  });
});

declare global {
  var __commissionPrismaMock: any;
  var __commissionRevalidatedPaths: unknown[][] | undefined;
}
