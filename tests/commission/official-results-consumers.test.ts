import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { getNetworkCommissionTotalByPeriod } from "../../src/features/commission-dashboard/queries/dashboard";
import { closeMonthlyCommissionPeriod, previewMonthlyCommissionClosure } from "../../src/features/commission-dashboard/actions/monthly-closing";
import { getEmployeesOverview } from "../../src/features/commission-dashboard/queries/employees";
import { getGoalsOverview } from "../../src/features/commission-dashboard/queries/goals";
import { getReportsOverview } from "../../src/features/commission-dashboard/queries/reports";
import { getUnitsOverview } from "../../src/features/commission-dashboard/queries/units";
import { calculateAndPersistUnit } from "../../src/features/commission-dashboard/actions/calculate-unit";
import { buildCsv, buildPrintHtml } from "../../src/lib/commission-dashboard";

const period = { year: 2026, month: 8 };
const metric = {
  goalAmount: 1000,
  resultAmount: 1000,
  goalLiters: 1000,
  goalStock: 1000,
  resultLiters: 1000,
  resultStock: 1000,
  closedAt: new Date("2026-08-31T00:00:00Z"),
};
const persistedRecord = {
  employeeId: "employee-1",
  unitId: "unit-1",
  employmentType: "PERMANENT" as const,
  employeeShift: "DAYTIME" as const,
  periodStatus: "ACTIVE" as const,
  soldLiters: 10,
  abastecimento: 1,
  soldStock: 10,
  baseGoalLiters: 1000,
  finalGoalLiters: 1000,
  baseRate: 0.01,
  baseCommission: 100,
  stockCommission: 50,
  dobras: 20,
  litersMultiplier: 1,
  stockMultiplier: 1,
  bonusApplied: false,
  bonusAmount: 0,
  totalCommission: 100,
  finalTotalCommission: 170,
  stockGoalCommission: 1000,
  employee: { name: "Funcionário Teste", status: "ACTIVE", unitId: "unit-1" },
  unit: { monthlyMetrics: [metric] },
};

function configure(overrides: Record<string, unknown> = {}) {
  globalThis.__commissionPrismaMock = {
    unit: {
      findMany: async () => [{
        id: "unit-1",
        name: "Unidade Teste",
        isActive: true,
        monthlyMetrics: [metric],
        employeeMonthlyRecords: [{
          unitId: "unit-1", totalCommission: 100, finalTotalCommission: 170,
          employee: { status: "ACTIVE", unitId: "unit-1" },
        }],
        _count: { employees: 1 },
      }],
      findFirst: async () => null,
    },
    employee: {
      findMany: async () => [{
        id: "employee-1",
        name: "Funcionário Teste",
        unitId: "unit-1",
        status: "ACTIVE",
        shift: "DAYTIME",
        employmentType: "PERMANENT",
        monthlyRecords: [{ totalCommission: 100, finalTotalCommission: 170 }],
      }],
      count: async () => 1,
    },
    unitMonthlyMetric: {
      findMany: async () => [],
      aggregate: async () => ({ _sum: {} }),
      findUnique: async () => null,
      update: async () => null,
    },
    employeeMonthlyRecord: {
      findMany: async () => [persistedRecord],
      aggregate: async () => ({ _sum: {} }),
      groupBy: async () => [],
      update: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
    $transaction: async () => null,
    ...overrides,
  };
}

beforeEach(() => configure());

describe("consumidores do resultado financeiro oficial", () => {
  test("dashboard soma finalTotalCommission, não o subtotal de litragem", async () => {
    assert.equal(await getNetworkCommissionTotalByPeriod(period), 170);
  });

  test("relatório fechado lê o valor persistido sem recalcular a fórmula antiga", async () => {
    const report = await getReportsOverview(period);
    assert.equal(report.employees[0].calculationStatus, "CLOSED");
    assert.equal(report.employees[0].totalCommission, 100);
    assert.equal(report.employees[0].finalTotalCommission, 170);
    assert.equal(report.employees[0].rankingCommission, 170);
    assert.equal(report.units[0].totalCommission, 170);
  });

  test("relatório aberto produz PREVIEW pelo motor oficial", async () => {
    configure({
      unit: {
        findMany: async () => [{ id: "unit-1", name: "Unidade Teste", monthlyMetrics: [{ ...metric, closedAt: null }] }],
        findFirst: async () => null,
      },
    });
    const report = await getReportsOverview(period);
    assert.equal(report.employees[0].calculationStatus, "PREVIEW");
    assert.equal(report.employees[0].commissionEligible, false);
    assert.equal(report.employees[0].baseCommission, 0);
    assert.equal(report.employees[0].finalTotalCommission, 0);
  });

  test("relatório fechado preserva estoque baseado na meta efetiva de experiência", async () => {
    configure({
      employeeMonthlyRecord: {
        findMany: async () => [{
          ...persistedRecord,
          employmentType: "PROBATION",
          soldLiters: 700,
          soldStock: 700,
          finalGoalLiters: 700,
          stockGoalCommission: 1000,
          baseCommission: 5.25,
          stockCommission: 100,
          dobras: 0,
          totalCommission: 5.25,
          finalTotalCommission: 105.25,
          commissionEligible: true,
          minimumEligibilityPercentage: 100,
        }],
      },
    });
    const employee = (await getReportsOverview(period)).employees[0];
    assert.equal(employee.metLitragem, true);
    assert.equal(employee.metEstoque, true);
    assert.equal(employee.correctedStock, 100);
    assert.equal(employee.rankingCommission, 105.25);
  });

  test("relatório fechado mantém funcionário histórico atualmente inativo", async () => {
    configure({
      employeeMonthlyRecord: {
        findMany: async () => [{ ...persistedRecord, employee: { name: "Histórico", status: "INACTIVE", unitId: "unit-1" } }],
      },
    });
    const report = await getReportsOverview(period);
    assert.equal(report.employees.length, 1);
    assert.equal(report.employees[0].name, "Histórico");
    assert.equal(report.employees[0].finalTotalCommission, 170);
  });

  test("relatório fechado exclui snapshot stale não processado e preserva participante com comissão zero", async () => {
    configure({
      employeeMonthlyRecord: {
        findMany: async () => [
          {
            ...persistedRecord,
            employeeId: "processed-zero",
            totalCommission: 0,
            finalTotalCommission: 0,
            employee: { name: "PARTICIPANTE ZERO", status: "INACTIVE", unitId: "unit-1" },
          },
          ...["HIGOR MATHEUS", "LUCAS BATISTA", "VINICIUS PEREIRA", "JEFERSON DA SILVA", "LUCAS"].map((name, index) => ({
            ...persistedRecord,
            employeeId: `stale-${index}`,
            totalCommission: null,
            finalTotalCommission: null,
            employee: { name, status: "INACTIVE" as const, unitId: "unit-1" },
          })),
        ],
      },
    });

    const report = await getReportsOverview(period);
    assert.deepEqual(report.employees.map((employee) => employee.id), ["processed-zero"]);
    assert.equal(report.employees[0].finalTotalCommission, 0);
    assert.equal(report.units[0].totalCommission, 0);

    const goals = await getGoalsOverview(period);
    assert.equal(goals.units[0].totalBaseCommission, 100);
  });

  test("relatório aberto ou reaberto exclui funcionário inativo da tela e dos totais", async () => {
    configure({
      unit: {
        findMany: async () => [{ id: "unit-1", name: "Unidade Teste", monthlyMetrics: [{ ...metric, closedAt: null, commissionRuleSetId: "rules-v1" }] }],
        findFirst: async () => null,
      },
      employeeMonthlyRecord: {
        findMany: async () => [{ ...persistedRecord, employee: { name: "LUCAS", status: "INACTIVE", unitId: "unit-1" } }],
      },
    });

    const report = await getReportsOverview(period);
    assert.deepEqual(report.employees, []);
    assert.equal(report.units[0].totalCommission, 0);
  });

  test("relatório operacional exige funcionário ativo vinculado à unidade do registro", async () => {
    configure({
      unit: {
        findMany: async () => [{ id: "unit-1", name: "Unidade Teste", monthlyMetrics: [{ ...metric, closedAt: null }] }],
        findFirst: async () => null,
      },
      employeeMonthlyRecord: {
        findMany: async () => [{ ...persistedRecord, employee: { name: "Transferido", status: "ACTIVE", unitId: "unit-2" } }],
      },
    });

    const report = await getReportsOverview(period);
    assert.deepEqual(report.employees, []);
    assert.equal(report.units[0].totalCommission, 0);
  });

  test("relatório fechado preserva valores e identidade por employeeId, inclusive homônimos", async () => {
    const secondRecord = {
      ...persistedRecord,
      employeeId: "employee-2",
      soldLiters: 20,
      soldStock: 30,
      baseCommission: 200,
      totalCommission: 220,
      finalTotalCommission: 250,
      employee: { name: "Mesmo Nome", status: "INACTIVE", unitId: "unit-2" },
    };
    configure({
      employeeMonthlyRecord: {
        findMany: async () => [
          { ...persistedRecord, employee: { name: "Mesmo Nome", status: "INACTIVE", unitId: "unit-1" } },
          secondRecord,
        ],
      },
    });

    const report = await getReportsOverview(period);
    assert.deepEqual(report.employees.map((employee) => employee.id), ["employee-1", "employee-2"]);
    assert.deepEqual(
      report.employees.map(({ soldLiters, soldStock, baseCommission, totalCommission, finalTotalCommission }) => ({ soldLiters, soldStock, baseCommission, totalCommission, finalTotalCommission })),
      [
        { soldLiters: 10, soldStock: 10, baseCommission: 100, totalCommission: 100, finalTotalCommission: 170 },
        { soldLiters: 20, soldStock: 30, baseCommission: 200, totalCommission: 220, finalTotalCommission: 250 },
      ],
    );

    const csv = buildCsv(report.units, report.employees, 7, 2026);
    const html = buildPrintHtml(report.units, report.employees, 7, 2026, "Relatório histórico");
    assert.equal((csv.match(/Mesmo Nome/g) ?? []).length, report.employees.length);
    assert.equal((html.match(/Mesmo Nome/g) ?? []).length, report.employees.length);
  });

  test("consulta de unidades usa finalTotalCommission", async () => {
    assert.equal((await getUnitsOverview(period)).units[0].totalCommission, 170);
  });

  test("consulta de funcionários usa finalTotalCommission", async () => {
    assert.equal((await getEmployeesOverview(period)).employees[0].totalCommission, 170);
  });

  test("consulta de metas agrega finalTotalCommission", async () => {
    const goals = await getGoalsOverview(period);
    assert.equal(goals.units[0].totalCommission, 170);
  });

  test("metas abertas não agregam funcionário inativo", async () => {
    configure({
      unit: {
        findMany: async () => [{
          id: "unit-1", name: "Unidade Teste", monthlyMetrics: [{ ...metric, closedAt: null }],
          _count: { employees: 1 },
        }],
        findFirst: async () => null,
      },
      employeeMonthlyRecord: {
        findMany: async () => [{
          ...persistedRecord,
          employee: { name: "INATIVO", status: "INACTIVE", unitId: "unit-1" },
        }],
      },
    });

    const goals = await getGoalsOverview(period);
    assert.equal(goals.units[0].totalCommission, 0);
    assert.equal(goals.units[0].totalBaseCommission, 0);
    assert.equal(goals.units[0].totalBonusAmount, 0);
  });

  test("preview consolidado exclui inativo de quantidade, litros, bônus e comissão", async () => {
    const active = {
      employeeId: "active", unitId: "unit-1", employmentType: "PERMANENT", employeeShift: "DAYTIME",
      baseGoalLiters: 10_000, soldLiters: 10_000, soldStock: null, stockCommission: null,
      stockGoalCommission: null, baseStockGoal: null, dobras: null,
      employee: { status: "ACTIVE", unitId: "unit-1" },
    };
    const stale = {
      ...active, employeeId: "inactive", soldLiters: 10_000,
      employee: { status: "INACTIVE", unitId: "unit-1" },
    };
    configure({
      unitMonthlyMetric: {
        findMany: async () => [{
          unitId: "unit-1", goalLiters: 20_000, goalStock: null, resultStock: null, closedAt: null,
          unit: { name: "Unidade Teste", employeeMonthlyRecords: [active, stale] },
        }],
        aggregate: async () => ({ _sum: {} }),
        findUnique: async () => null,
        update: async () => null,
      },
    });

    const result = await previewMonthlyCommissionClosure(period);
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.preview.employeeCount, 1);
    assert.equal(result.preview.units[0].unitSoldLiters, 10_000);
    assert.equal(result.preview.units[0].bonusUnlocked, false);
    assert.equal(result.preview.units[0].totalCommission, 80);
  });

  test("recálculo operacional não calcula nem persiste funcionário inativo", async () => {
    const updates: string[] = [];
    configure({
      unitMonthlyMetric: {
        findUnique: async () => ({ goalLiters: 20_000, closedAt: null }),
        findMany: async () => [],
        aggregate: async () => ({ _sum: {} }),
        update: async () => null,
      },
      employeeMonthlyRecord: {
        findMany: async () => [
          { id: "active-record", employeeId: "active", employmentType: "PERMANENT", employeeShift: "DAYTIME", baseGoalLiters: 10_000, soldLiters: 10_000, employee: { status: "ACTIVE", unitId: "unit-1" } },
          { id: "inactive-record", employeeId: "inactive", employmentType: "PERMANENT", employeeShift: "DAYTIME", baseGoalLiters: 10_000, soldLiters: 10_000, employee: { status: "INACTIVE", unitId: "unit-1" } },
        ],
        update: async ({ where }: { where: { id: string } }) => { updates.push(where.id); },
      },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    });

    assert.deepEqual(await calculateAndPersistUnit({ unitId: "unit-1", year: 2026, month: 8 }), { success: true });
    assert.deepEqual(updates, ["active-record"]);
  });

  test("CSV apresenta o resultado final já resolvido pelo relatório", async () => {
    const report = await getReportsOverview(period);
    const csv = buildCsv(report.units, report.employees, 7, 2026);
    assert.match(csv, /Funcionário Teste[^\r\n]*;170,00/);
    assert.match(csv, /Comissão Total Rede[^\r\n]*170,00/);
  });

  test("fechamento global delega ao motor oficial sem regra alternativa de 80%", async () => {
    const employeeUpdates: Array<{ data: Record<string, unknown> }> = [];
    const rows = [{
      unitId: "unit-1",
      goalLiters: 20_000,
      goalStock: 1000,
      resultStock: 1000,
      closedAt: null,
      unit: {
        name: "Unidade Teste",
        employeeMonthlyRecords: [{
          employeeId: "employee-1",
          unitId: "unit-1",
          employmentType: "PERMANENT",
          employeeShift: "DAYTIME",
          baseGoalLiters: 10_000,
          soldLiters: 10_000,
          soldStock: 1000,
          stockCommission: 50,
          stockGoalCommission: 1000,
          dobras: 20,
          employee: { status: "ACTIVE", unitId: "unit-1" },
        }],
      },
    }];
    const tx = {
      commissionRuleSet: {
        findMany: async () => [{
          id: "rules-v1", version: 1,
          daytimePermanentRate: 0.01, nighttimePermanentRate: 0.03,
          daytimeProbationRate: 0.0075, nighttimeProbationRate: 0.02,
          probationGoalFactor: 0.7, minimumEligibilityPercentage: 100, neutralMultiplier: 1,
          greenMinimumPercentage: 105, greenMultiplier: 1.15,
          blueMinimumPercentage: 135, blueMultiplier: 1.25, teamBonusRate: 0.05,
        }],
      },
      unitMonthlyMetric: {
        findMany: async () => rows,
        update: async () => null,
      },
      employeeMonthlyRecord: {
        update: async (args: { data: Record<string, unknown> }) => {
          employeeUpdates.push(args);
          return args;
        },
      },
    };
    configure({ $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx) });

    const result = await closeMonthlyCommissionPeriod(period);
    assert.equal(result.success, true);
    assert.equal(employeeUpdates[0].data.totalCommission, 100);
    assert.equal(employeeUpdates[0].data.finalTotalCommission, 170);
  });
});

declare global {
  var __commissionPrismaMock: any;
}
