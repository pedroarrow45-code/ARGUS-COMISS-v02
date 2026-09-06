import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  compareCommissionRules, createCommissionRuleSetVersion, getCurrentCommissionRuleSet,
  listCommissionRuleSetHistory, validateCommissionRuleSetChange,
} from "../../src/features/commission-dashboard/rules/manage-commission-rules";
import type { CommissionRuleSetChangeInput } from "../../src/features/commission-dashboard/rules/manage-commission-rules";

const base: CommissionRuleSetChangeInput = {
  effectiveYear: 2026, effectiveMonth: 9,
  permanentDaytimeRate: 0.01, permanentNighttimeRate: 0.03,
  probationDaytimeRate: 0.0075, probationNighttimeRate: 0.02,
  probationGoalFactor: 0.7, minimumEligibilityPercentage: 70, neutralMultiplier: 1,
  greenThreshold: 105, greenMultiplier: 1.15,
  blueThreshold: 135, blueMultiplier: 1.25, teamBonusFactor: 0.05,
};

function ruleRow(version = 1, from = "2000-01-01", until: string | null = null, status = "ACTIVE") {
  return {
    id: `v${version}`, version, status, validFrom: new Date(`${from}T00:00:00Z`), validUntil: until ? new Date(`${until}T00:00:00Z`) : null,
    daytimePermanentRate: 0.01, nighttimePermanentRate: 0.03, daytimeProbationRate: 0.0075, nighttimeProbationRate: 0.02,
    probationGoalFactor: 0.7, minimumEligibilityPercentage: 70, neutralMultiplier: 1, greenMinimumPercentage: 105, greenMultiplier: 1.15,
    blueMinimumPercentage: 135, blueMultiplier: 1.25, teamBonusRate: 0.05,
  };
}

function database({ closed = 0, rows = [ruleRow()] }: { closed?: number; rows?: any[] } = {}) {
  const state = [...rows];
  const tx = {
    unitMonthlyMetric: { count: async () => closed },
    commissionRuleSet: {
      findMany: async () => [...state].sort((a, b) => b.version - a.version),
      findFirst: async () => state.filter((r) => r.status === "ACTIVE").sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0] ?? null,
      update: async ({ where, data }: any) => Object.assign(state.find((r) => r.id === where.id), data),
      create: async ({ data }: any) => { const created = { id: `v${data.version}`, validUntil: null, ...data }; state.push(created); return created; },
    },
  };
  return {
    state,
    db: {
      ...tx,
      $transaction: async (callback: any, options: any) => { assert.equal(options.isolationLevel, "Serializable"); return callback(tx); },
    } as any,
  };
}

describe("gestão segura de versões", () => {
  test("cria V2 no servidor, encerra V1 no fim do mês anterior e preserva 0.0075", async () => {
    const { db, state } = database();
    const created = await createCommissionRuleSetVersion({ ...base, greenMultiplier: 1.2 }, db);
    assert.equal(created.version, 2);
    assert.equal(created.validFrom, "2026-09-01");
    assert.equal(created.probationDaytimeRate, 0.0075);
    assert.equal(created.greenMultiplier, 1.2);
    assert.equal(state[0].status, "RETIRED");
    assert.equal(state[0].validUntil.toISOString().slice(0, 10), "2026-08-31");
    assert.equal(state.length, 2);
  });

  test("permite competência totalmente aberta e rejeita qualquer competência total ou parcialmente fechada", async () => {
    await assert.doesNotReject(() => createCommissionRuleSetVersion(base, database({ closed: 0 }).db));
    await assert.rejects(() => createCommissionRuleSetVersion(base, database({ closed: 1 }).db), /parcialmente fechada/);
  });

  test("rejeita sobreposição com versão futura", async () => {
    const rows = [ruleRow(2, "2026-10-01"), ruleRow(1, "2000-01-01", "2026-09-30", "RETIRED")];
    await assert.rejects(() => createCommissionRuleSetVersion(base, database({ rows }).db), /sobrepõe/);
  });

  test("valida competência, finitude, taxas, zonas, multiplicadores e precisão", () => {
    const invalid = [
      { effectiveMonth: 13 }, { effectiveYear: 1999 }, { permanentDaytimeRate: -1 },
      { greenThreshold: 135 }, { greenMultiplier: 0 }, { teamBonusFactor: Number.NaN },
      { probationDaytimeRate: 0.00751 },
    ];
    for (const change of invalid) assert.throws(() => validateCommissionRuleSetChange({ ...base, ...change }));
  });

  test("retorna regra vigente e histórico ordenado para a futura UI", async () => {
    const rows = [ruleRow(1, "2000-01-01", "2026-08-31", "RETIRED"), ruleRow(2, "2026-09-01")];
    const { db } = database({ rows });
    assert.equal((await getCurrentCommissionRuleSet(db, new Date("2026-08-15T00:00:00Z")))?.version, 1);
    assert.equal((await getCurrentCommissionRuleSet(db, new Date("2026-09-15T00:00:00Z")))?.version, 2);
    assert.deepEqual((await listCommissionRuleSetHistory(db)).map((r) => r.version), [2, 1]);
  });

  test("gera diff puro somente para parâmetros alterados", () => {
    const differences = compareCommissionRules(base, { ...base, permanentDaytimeRate: 0.012, greenMultiplier: 1.2, blueThreshold: 125 });
    assert.deepEqual(differences, [
      { field: "permanentDaytimeRate", before: 0.01, after: 0.012 },
      { field: "greenMultiplier", before: 1.15, after: 1.2 },
      { field: "blueThreshold", before: 135, after: 125 },
    ]);
  });

  test("traduz conflito concorrente de versão/serialização em erro seguro", async () => {
    const db = { $transaction: async () => { throw { code: "P2002" }; } } as any;
    await assert.rejects(() => createCommissionRuleSetVersion(base, db), /Conflito concorrente/);
  });
});
