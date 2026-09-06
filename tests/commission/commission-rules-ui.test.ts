import assert from "node:assert/strict";
import test from "node:test";
import { compareCommissionRules } from "../../src/features/commission-dashboard/rules/manage-commission-rules.ts";
import { commissionRulesDraftToInput, commissionRulesToDraft, findScheduledRule, friendlyCommissionRulesError, nextCompetence, ruleSetToComparableInput } from "../../src/features/commission-dashboard/rules/commission-rules-ui.ts";

const current = {
  id: "v1", version: 1, status: "ACTIVE" as const, validFrom: "2000-01-01", validUntil: "2026-08-31",
  effectiveYear: 2000, effectiveMonth: 1, permanentDaytimeRate: 0.01, permanentNighttimeRate: 0.03,
  probationDaytimeRate: 0.0075, probationNighttimeRate: 0.02, probationGoalFactor: 0.7, minimumEligibilityPercentage: 70,
  neutralMultiplier: 1, greenThreshold: 105, greenMultiplier: 1.15, blueThreshold: 135,
  blueMultiplier: 1.25, teamBonusFactor: 0.05,
};
const future = { ...current, id: "v2", version: 2, validFrom: "2026-09-01", validUntil: null, effectiveYear: 2026, effectiveMonth: 9 };

test("carrega a configuração em um draft legível e preserva 0.0075", () => {
  const draft = commissionRulesToDraft(current, 2026, 9);
  assert.equal(draft.probationDaytimeRate, "0.0075");
  assert.equal(draft.probationGoalFactor, "70");
  assert.equal(draft.greenMultiplier, "1.15");
});

test("converte percentuais da UI para fatores do contrato da aplicação", () => {
  const input = commissionRulesDraftToInput(commissionRulesToDraft(current, 2026, 9));
  assert.equal(input.probationGoalFactor, 0.7);
  assert.equal(input.minimumEligibilityPercentage, 100);
  assert.equal(input.greenMultiplier, 1.15);
  assert.equal(input.teamBonusFactor, 0.05);
});

test("mantém thresholds como percentuais inteiros do backend", () => {
  const input = commissionRulesDraftToInput(commissionRulesToDraft(current, 2026, 9));
  assert.equal(input.greenThreshold, 105);
  assert.equal(input.blueThreshold, 135);
});

test("gera somente diferenças financeiras modificadas", () => {
  const before = ruleSetToComparableInput(current);
  const after = { ...before, permanentDaytimeRate: 0.012, greenMultiplier: 1.2 };
  assert.deepEqual(compareCommissionRules(before, after).map((item) => item.field), ["permanentDaytimeRate", "greenMultiplier"]);
});

test("não gera diff quando o usuário não altera valores", () => {
  const input = ruleSetToComparableInput(current);
  assert.deepEqual(compareCommissionRules(input, { ...input, effectiveYear: 2026, effectiveMonth: 9 }), []);
});

test("identifica a próxima versão sem apresentá-la como vigente", () => {
  assert.equal(findScheduledRule([future, current], new Date("2026-08-15T00:00:00Z"))?.id, "v2");
  assert.equal(findScheduledRule([future, current], new Date("2026-09-15T00:00:00Z")), null);
});

test("seleciona o primeiro dia lógico da próxima competência", () => {
  assert.deepEqual(nextCompetence(new Date("2026-12-20T00:00:00Z")), { year: 2027, month: 1 });
});

test("traduz erro de competência fechada para linguagem de negócio", () => {
  assert.match(friendlyCommissionRulesError(new Error("A vigência alcança competência parcialmente fechada.")), /unidades fechadas/);
});

test("traduz conflito concorrente sem expor Prisma", () => {
  const text = friendlyCommissionRulesError(new Error("Conflito concorrente P2034"));
  assert.match(text, /Outra alteração/); assert.doesNotMatch(text, /P2034/);
});

test("traduz sobreposição de versão programada", () => {
  assert.match(friendlyCommissionRulesError(new Error("A nova vigência sobrepõe uma versão futura.")), /configuração programada/);
});
