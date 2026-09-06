import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { calculateCommission, CURRENT_COMMISSION_RULES } from "../../src/features/commission-dashboard/engine/calculate-commission";
import { getCommissionRulesForPeriod } from "../../src/features/commission-dashboard/rules/get-commission-rules";

const decimal = (value: string) => ({ toNumber: () => Number(value), toString: () => value });
function row(version: number, validFrom: string, validUntil: string | null, green = "1.1500") {
  return {
    id: `rules-v${version}`, version, status: version === 1 ? "RETIRED" : "ACTIVE",
    validFrom: new Date(`${validFrom}T00:00:00Z`), validUntil: validUntil ? new Date(`${validUntil}T00:00:00Z`) : null,
    daytimePermanentRate: decimal("0.0100"), nighttimePermanentRate: decimal("0.0300"),
    daytimeProbationRate: decimal("0.0075"), nighttimeProbationRate: decimal("0.0200"),
    probationGoalFactor: decimal("0.7000"), minimumEligibilityPercentage: decimal("100.00"), neutralMultiplier: decimal("1.0000"),
    greenMinimumPercentage: decimal("105.00"), greenMultiplier: decimal(green),
    blueMinimumPercentage: decimal("135.00"), blueMultiplier: decimal("1.2500"), teamBonusRate: decimal("0.0500"),
  };
}

function database(rows: ReturnType<typeof row>[]) {
  return {
    commissionRuleSet: {
      findMany: async ({ where }: any) => rows.filter((candidate) =>
        candidate.validFrom <= where.validFrom.lte &&
        (candidate.validUntil == null || candidate.validUntil >= where.validFrom.lte),
      ),
    },
  } as any;
}

describe("regras versionadas de comissão", () => {
  test("versão inicial preserva exatamente todos os parâmetros atuais e a taxa 0.0075", async () => {
    const resolved = await getCommissionRulesForPeriod({ year: 2026, month: 8 }, database([row(1, "2000-01-01", null)]));
    assert.deepEqual(resolved.rules, CURRENT_COMMISSION_RULES);
    assert.equal(resolved.rules.rates.DAYTIME.PROBATION, 0.0075);
    assert.deepEqual(resolved.rules.zones, {
      greenMinimumPercentage: 105, blueMinimumPercentage: 135,
      neutralMultiplier: 1, greenMultiplier: 1.15, blueMultiplier: 1.25,
    });
    assert.equal(resolved.rules.teamBonusRate, 0.05);
  });

  test("competência antiga resolve v1 e competência futura resolve v2", async () => {
    const db = database([row(1, "2000-01-01", "2026-08-31"), row(2, "2026-09-01", null, "1.2000")]);
    assert.equal((await getCommissionRulesForPeriod({ year: 2026, month: 8 }, db)).version, 1);
    assert.equal((await getCommissionRulesForPeriod({ year: 2026, month: 9 }, db)).version, 2);
  });

  test("resultado histórico de v1 permanece estável após criar v2", async () => {
    const db = database([row(1, "2000-01-01", "2026-08-31"), row(2, "2026-09-01", null, "1.2000")]);
    const august = await getCommissionRulesForPeriod({ year: 2026, month: 8 }, db);
    const september = await getCommissionRulesForPeriod({ year: 2026, month: 9 }, db);
    const input = {
      employmentType: "PERMANENT" as const, employeeShift: "DAYTIME" as const,
      baseGoalLiters: 1000, soldLiters: 1050, unitMetLitersGoal: false,
      soldStock: null, stockGoal: null, stockBaseCommission: 0, dobras: 0,
    };
    const closedAugust = { ruleSetId: august.id, finalTotalCommission: calculateCommission(input, august.rules).finalTotalCommission };
    assert.deepEqual(closedAugust, { ruleSetId: "rules-v1", finalTotalCommission: 9.66 });
    assert.equal(calculateCommission(input, september.rules).finalTotalCommission, 10.08);
    assert.equal(closedAugust.finalTotalCommission, 9.66);
  });

  test("rejeita ausência e sobreposição de versões", async () => {
    await assert.rejects(() => getCommissionRulesForPeriod({ year: 2026, month: 8 }, database([])), /Nenhuma regra/);
    await assert.rejects(
      () => getCommissionRulesForPeriod({ year: 2026, month: 8 }, database([row(1, "2000-01-01", null), row(2, "2026-01-01", null)])),
      /Mais de uma regra/,
    );
  });
});
