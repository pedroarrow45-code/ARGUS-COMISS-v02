import assert from "node:assert/strict";
import test from "node:test";
import { calculateCommission, CURRENT_COMMISSION_RULES } from "../../src/features/commission-dashboard/engine/calculate-commission.ts";
import { classifyAugustFinancialSnapshot } from "../../src/features/commission-dashboard/engine/classify-august-financial-snapshot.ts";

const calculation = (overrides: any = {}) => calculateCommission({ employmentType: "PERMANENT", employeeShift: "DAYTIME", baseGoalLiters: 1000, soldLiters: 1000, unitMetLitersGoal: false, soldStock: 1000, stockGoal: 1000, stockBaseCommission: 100, dobras: 0, ...overrides }, CURRENT_COMMISSION_RULES);
const classify = (expected: any, persisted: any = {}, overrides: any = {}) => classifyAugustFinancialSnapshot({ unitName: "Unidade", employmentType: "PERMANENT", commissionRuleSetId: "rules", sourceComplete: true, sourceValid: true, deterministic: true, expected, persisted: { baseCommission: expected?.baseCommission ?? 0, litersMultiplier: expected?.litersMultiplier ?? 0, stockMultiplier: expected?.stockMultiplier ?? 0, totalCommission: expected?.totalCommission ?? 0, finalTotalCommission: expected?.finalTotalCommission ?? 0, ...persisted }, ...overrides });

test("somente estoque correto é UI-only e nunca candidato", () => { const e = calculation({ soldLiters: 900 }); assert.equal(classify(e, { totalCommission: 0, finalTotalCommission: e.finalTotalCommission }).classification, "FINANCIAL_MATCH_UI_ONLY"); });
test("somente litros respeita 80%", () => { const e = calculation({ soldStock: 900 }); assert.equal(e.litersFactor, .8); assert.equal(classify(e).classification, "FINANCIAL_MATCH"); });
test("ambas metas pagam 100%", () => { const e = calculation(); assert.equal(e.litersFactor, 1); assert.equal(e.stockFactor, 1); });
test("nenhuma meta paga zero", () => { const e = calculation({ soldLiters: 900, soldStock: 900 }); assert.equal(e.finalTotalCommission, 0); assert.equal(classify(e).classification, "FINANCIAL_MATCH"); });
test("Experiência Verde usa meta efetiva uma vez", () => { const e = calculation({ employmentType: "PROBATION", soldLiters: 735, soldStock: null, stockGoal: null }); assert.equal(e.effectiveGoalLiters, 700); assert.equal(e.litersMultiplier, 1.15); });
test("Experiência Azul", () => { const e = calculation({ employmentType: "PROBATION", soldLiters: 945, soldStock: null, stockGoal: null }); assert.equal(e.litersMultiplier, 1.25); });
test("CASO_C é seguro quando multiplicador de experiência não foi persistido", () => { const e = calculation({ employmentType: "PROBATION", soldLiters: 735 }); assert.deepEqual(classify(e, { litersMultiplier: 1, finalTotalCommission: e.finalTotalCommission - 10 }, { employmentType: "PROBATION" }).classification, "SAFE_KNOWN_FINANCIAL_BUG"); });
test("Esmeraldas com litros zerados é padrão conhecido", () => { const e = calculation({ soldLiters: 1200 }); assert.equal(classify(e, { baseCommission: 0, litersMultiplier: 0, totalCommission: 0, finalTotalCommission: 100 }, { unitName: "Esmeraldas" }).technicalReason, "AUG_ESMERALDAS_LITERS_ZERO"); });
test("final correto ignora metadados derivados divergentes", () => { const e = calculation(); assert.match(classify(e, { baseCommission: 0 }).classification, /^FINANCIAL_MATCH/); });
test("fonte ausente nunca é SAFE", () => { const e = calculation(); assert.equal(classify(e, {}, { sourceComplete: false }).classification, "MISSING_SOURCE_DATA"); });
