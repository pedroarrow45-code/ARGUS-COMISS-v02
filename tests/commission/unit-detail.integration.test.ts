import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { ensureOpenMonthlyRecords, fetchUnitMonthlyDetail } from "../../src/features/commission-dashboard/actions/unit-detail";

afterEach(() => { delete globalThis.__commissionPrismaMock; });

test("Esmeraldas fechado usa registros mensais, snapshots e total oficial mesmo sem funcionário ativo atual", async () => {
  const record = {
    id: "record-rafael", employeeId: "rafael", employmentType: "PROBATION", employeeShift: "DAYTIME",
    baseGoalLiters: 33_000, finalGoalLiters: 23_100, soldLiters: 33_877.994, abastecimento: 1,
    goalSource: "MANUAL", periodStatus: "ACTIVE", soldStock: 1_610, stockCommission: 100,
    stockGoalCommission: 2_300, baseStockGoal: 2_300, effectiveStockGoal: 1_610, dobras: 0,
    stockMultiplier: 1, litersMultiplier: 1.25, baseCommission: 254.08, bonusAmount: 0,
    totalCommission: 317.6, finalTotalCommission: 2_588.57, commissionEligible: true,
    minimumEligibilityPercentage: 100, ineligibilityReason: null, employee: { name: "RAFAEL CAMPOS" },
  };
  globalThis.__commissionPrismaMock = {
    unit: { findUnique: async () => ({ id: "esmeraldas", name: "POSTO BRASIL - ESMERALDAS", isActive: true }) },
    unitMonthlyMetric: { findUnique: async () => ({ goalAmount: 0, resultAmount: 0, goalLiters: 100_000, closedAt: new Date("2026-08-31"), commissionRuleSetId: "rules-v1" }) },
    employee: { findMany: async () => [] },
    employeeMonthlyRecord: { findMany: async () => [
      record,
      {
        ...record, id: "stale", employeeId: "stale", totalCommission: null, finalTotalCommission: null,
        commissionEligible: null, employee: { name: "LUCAS", status: "INACTIVE", unitId: "esmeraldas" },
      },
    ] },
    commissionRuleSet: { findUnique: async () => ({
      id: "rules-v1", version: 1, daytimePermanentRate: 0.01, nighttimePermanentRate: 0.03,
      daytimeProbationRate: 0.0075, nighttimeProbationRate: 0.02, probationGoalFactor: 0.7,
      minimumEligibilityPercentage: 100, teamBonusRate: 0.05, neutralMultiplier: 1,
      greenMinimumPercentage: 105, greenMultiplier: 1.15, blueMinimumPercentage: 135, blueMultiplier: 1.25,
    }) },
  };

  const result = await fetchUnitMonthlyDetail("esmeraldas", 2026, 8);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.commissionTotal, 2_588.57);
  assert.equal(result.data.employees.length, 1);
  assert.equal(result.data.employees[0].name, "RAFAEL CAMPOS");
  assert.equal(result.data.employees[0].finalGoalLiters, 23_100);
  assert.ok(Math.abs(result.data.employees[0].achievementPercentage - 146.658) < 0.001);
  assert.equal(result.data.employees[0].litersZone, "BLUE");
  assert.equal(result.data.employees[0].totalCommission, 317.6);
  assert.equal(result.data.employees[0].finalTotalCommission, 2_588.57);
});

test("TOTAL usa resultado oficial quando somente estoque foi atingido", async () => {
  const record = {
    id: "record-kamila", employeeId: "kamila", employmentType: "PROBATION", employeeShift: "DAYTIME",
    baseGoalLiters: 24_000, finalGoalLiters: 16_800, soldLiters: 16_195.2, abastecimento: 0,
    goalSource: "MANUAL", periodStatus: "ACTIVE", soldStock: 1_210, stockCommission: 98.16,
    stockGoalCommission: 1_428.57, baseStockGoal: 1_428.57, effectiveStockGoal: 1_000, dobras: 0,
    stockMultiplier: 1.15, litersMultiplier: 0, baseCommission: 0, bonusAmount: 0,
    totalCommission: 0, finalTotalCommission: 118.78, commissionEligible: false,
    minimumEligibilityPercentage: 100, ineligibilityReason: "Abaixo da meta mínima.", employee: { name: "KAMILA VITORIA" },
  };
  globalThis.__commissionPrismaMock = {
    unit: { findUnique: async () => ({ id: "unit", name: "UNIDADE", isActive: true }) },
    unitMonthlyMetric: { findUnique: async () => ({ goalAmount: 0, resultAmount: 0, goalLiters: 100_000, closedAt: new Date("2026-08-31"), commissionRuleSetId: "rules-v1" }) },
    employee: { findMany: async () => [] },
    employeeMonthlyRecord: { findMany: async () => [record] },
    commissionRuleSet: { findUnique: async () => ({
      id: "rules-v1", version: 1, daytimePermanentRate: 0.01, nighttimePermanentRate: 0.03,
      daytimeProbationRate: 0.0075, nighttimeProbationRate: 0.02, probationGoalFactor: 0.7,
      minimumEligibilityPercentage: 100, teamBonusRate: 0.05, neutralMultiplier: 1,
      greenMinimumPercentage: 105, greenMultiplier: 1.15, blueMinimumPercentage: 135, blueMultiplier: 1.25,
    }) },
  };

  const result = await fetchUnitMonthlyDetail("unit", 2026, 8);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.employees[0].totalCommission, 0);
  assert.equal(result.data.employees[0].finalTotalCommission, 118.78);
  assert.equal(result.data.commissionTotal, 118.78);
});

test("mês reaberto usa somente ativos na grade e no total mesmo com regra vinculada", async () => {
  const staleRecord = {
    id: "stale", employeeId: "inactive", employmentType: "PERMANENT", employeeShift: "DAYTIME",
    baseGoalLiters: 10_000, finalGoalLiters: 10_000, soldLiters: 10_000, abastecimento: 0,
    goalSource: "AUTOMATIC", periodStatus: "ACTIVE", soldStock: null, stockCommission: null,
    stockGoalCommission: null, baseStockGoal: null, effectiveStockGoal: null, dobras: null,
    stockMultiplier: null, litersMultiplier: 1, baseCommission: 100, bonusAmount: 0,
    totalCommission: 100, finalTotalCommission: 100, commissionEligible: true,
    minimumEligibilityPercentage: 100, ineligibilityReason: null,
    employee: { name: "INATIVO", status: "INACTIVE", unitId: "unit" },
  };
  globalThis.__commissionPrismaMock = {
    unit: { findUnique: async () => ({ id: "unit", name: "UNIDADE", isActive: true }) },
    unitMonthlyMetric: { findUnique: async () => ({ goalAmount: 0, resultAmount: 0, goalLiters: 10_000, closedAt: null, commissionRuleSetId: "rules-v1" }) },
    employee: { findMany: async () => [{ id: "active", name: "ATIVO", shift: "DAYTIME", employmentType: "PERMANENT" }] },
    employeeMonthlyRecord: { findMany: async () => [staleRecord] },
    commissionRuleSet: { findUnique: async () => ({
      id: "rules-v1", version: 1, daytimePermanentRate: 0.01, nighttimePermanentRate: 0.03,
      daytimeProbationRate: 0.0075, nighttimeProbationRate: 0.02, probationGoalFactor: 0.7,
      minimumEligibilityPercentage: 100, teamBonusRate: 0.05, neutralMultiplier: 1,
      greenMinimumPercentage: 105, greenMultiplier: 1.15, blueMinimumPercentage: 135, blueMultiplier: 1.25,
    }) },
  };

  const result = await fetchUnitMonthlyDetail("unit", 2026, 8);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.data.employees.map((employee) => employee.employeeId), ["active"]);
  assert.equal(result.data.commissionTotal, 0);
});

function inheritanceHarness(options: {
  existing?: Array<{ employeeId: string; baseGoalLiters: number; goalSource?: "AUTOMATIC" | "MANUAL" }>;
  historicalBaseGoal?: number | null;
  historicalYear?: number;
  historicalMonth?: number;
  closedAt?: Date | null;
  commissionRuleSetId?: string | null;
  employmentType?: "PERMANENT" | "PROBATION";
}) {
  const existing = options.existing ?? [];
  const baseGoalUpdates: Array<{ where: any; data: any }> = [];
  const created: any[] = [];
  const employee = { id: "employee-1", shift: "DAYTIME", employmentType: options.employmentType ?? "PERMANENT" };
  globalThis.__commissionPrismaMock = {
    unit: { findUnique: async () => ({ isActive: true }) },
    unitMonthlyMetric: { findUnique: async () => ({ closedAt: options.closedAt ?? null, commissionRuleSetId: options.commissionRuleSetId ?? null }) },
    employee: { findMany: async () => [employee] },
    employeeMonthlyRecord: {
      findMany: async () => existing,
      findFirst: async ({ where }: any) => {
        if (where.baseGoalLiters) {
          assert.deepEqual(where.baseGoalLiters, { gt: 0 });
          return options.historicalBaseGoal == null ? null : {
            baseGoalLiters: options.historicalBaseGoal,
            baseStockGoal: null,
            year: options.historicalYear ?? 2026,
            month: options.historicalMonth ?? 8,
          };
        }
        return null;
      },
      createMany: async ({ data }: any) => { created.push(...data); return { count: data.length }; },
      updateMany: async (args: any) => {
        if (Object.hasOwn(args.data, "baseGoalLiters")) {
          baseGoalUpdates.push(args);
          const record = existing.find((row) => row.employeeId === args.where.employeeId);
          if (record && record.baseGoalLiters <= 0) record.baseGoalLiters = args.data.baseGoalLiters;
        }
        return { count: 1 };
      },
    },
  };
  return { baseGoalUpdates, created, existing };
}

test("registro inexistente herda a última meta base positiva", async () => {
  const state = inheritanceHarness({ historicalBaseGoal: 32_000 });
  await ensureOpenMonthlyRecords("unit-1", 2026, 9);
  assert.equal(state.created[0].baseGoalLiters, 32_000);
});

test("registro existente zerado herda somente a última meta base positiva", async () => {
  const state = inheritanceHarness({ existing: [{ employeeId: "employee-1", baseGoalLiters: 0 }], historicalBaseGoal: 32_000 });
  await ensureOpenMonthlyRecords("unit-1", 2026, 9);
  assert.deepEqual(state.baseGoalUpdates, [{ where: { employeeId: "employee-1", year: 2026, month: 9, baseGoalLiters: { lte: 0 } }, data: { baseGoalLiters: 32_000 } }]);
});

test("registro existente com meta positiva permanece intacto", async () => {
  const state = inheritanceHarness({ existing: [{ employeeId: "employee-1", baseGoalLiters: 31_000 }], historicalBaseGoal: 32_000 });
  await ensureOpenMonthlyRecords("unit-1", 2026, 9);
  assert.equal(state.baseGoalUpdates.length, 0);
});

test("meta manual positiva permanece intacta", async () => {
  const state = inheritanceHarness({ existing: [{ employeeId: "employee-1", baseGoalLiters: 31_000, goalSource: "MANUAL" }], historicalBaseGoal: 32_000 });
  await ensureOpenMonthlyRecords("unit-1", 2026, 9);
  assert.equal(state.baseGoalUpdates.length, 0);
});

test("histórico imediato zerado é ignorado e usa o último base positivo", async () => {
  const state = inheritanceHarness({ existing: [{ employeeId: "employee-1", baseGoalLiters: 0 }], historicalBaseGoal: 22_000, historicalMonth: 7 });
  await ensureOpenMonthlyRecords("unit-1", 2026, 9);
  assert.equal(state.baseGoalUpdates[0].data.baseGoalLiters, 22_000);
});

test("sem histórico positivo mantém zero e não inventa meta", async () => {
  const state = inheritanceHarness({ existing: [{ employeeId: "employee-1", baseGoalLiters: 0 }], historicalBaseGoal: null });
  await ensureOpenMonthlyRecords("unit-1", 2026, 9);
  assert.equal(state.baseGoalUpdates.length, 0);
  assert.equal(state.existing[0].baseGoalLiters, 0);
});

test("período fechado não é reparado automaticamente", async () => {
  const state = inheritanceHarness({ existing: [{ employeeId: "employee-1", baseGoalLiters: 0 }], historicalBaseGoal: 32_000, closedAt: new Date("2026-09-30") });
  await ensureOpenMonthlyRecords("unit-1", 2026, 9);
  assert.equal(state.baseGoalUpdates.length, 0);
});

test("período histórico reaberto não é reparado automaticamente", async () => {
  const state = inheritanceHarness({ existing: [{ employeeId: "employee-1", baseGoalLiters: 0 }], historicalBaseGoal: 32_000, commissionRuleSetId: "rules-v1" });
  await ensureOpenMonthlyRecords("unit-1", 2026, 9);
  assert.equal(state.baseGoalUpdates.length, 0);
});

test("finalGoalLiters positivo nunca é usado como fonte", async () => {
  const state = inheritanceHarness({ existing: [{ employeeId: "employee-1", baseGoalLiters: 0 }], historicalBaseGoal: null });
  await ensureOpenMonthlyRecords("unit-1", 2026, 9);
  assert.equal(state.baseGoalUpdates.length, 0);
});

test("funcionário em experiência herda a meta base completa sem fator", async () => {
  const state = inheritanceHarness({ existing: [{ employeeId: "employee-1", baseGoalLiters: 0 }], historicalBaseGoal: 24_000, employmentType: "PROBATION" });
  await ensureOpenMonthlyRecords("unit-1", 2026, 9);
  assert.equal(state.baseGoalUpdates[0].data.baseGoalLiters, 24_000);
});

test("repetição é idempotente após o primeiro reparo", async () => {
  const state = inheritanceHarness({ existing: [{ employeeId: "employee-1", baseGoalLiters: 0 }], historicalBaseGoal: 32_000 });
  await ensureOpenMonthlyRecords("unit-1", 2026, 9);
  await ensureOpenMonthlyRecords("unit-1", 2026, 9);
  assert.equal(state.baseGoalUpdates.length, 1);
});

declare global { var __commissionPrismaMock: any; }
