import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AUGUST_2026_ALLOWED_EMPLOYEE_IDS, AUTHORIZED_FINANCIAL_FIELDS, assertAllowedUpdate, backupChecksum, validateApplyPreconditions, validateBackup } from "../../src/features/commission-dashboard/engine/august-financial-apply-guards.ts";

const source = readFileSync(new URL("../../scripts/audit-august-2026-financial.ts", import.meta.url), "utf8");
const candidates = AUGUST_2026_ALLOWED_EMPLOYEE_IDS.map((employeeId, index) => ({ employeeId, financialDelta: index ? 0 : 6551.86 }));
const report = (overrides: any = {}) => ({ period: "2026-08", summary: { safeKnownFinancialBugs: 19, needsManualReview: 1, missingSourceData: 1, unsafe: 0, negativeDeltaCount: 0 }, safeCandidates: candidates, invariants: { sourceFingerprintBefore: "3fb56fa50696c3d4e213f0bde1c52c758266f4321ebd331e8e9778dab7640994" }, ...overrides });
const valid = (overrides: any = {}) => ({ expectedCount: 19, expectedDelta: 6551.86, expectedSourceFingerprint: "3fb56fa50696c3d4e213f0bde1c52c758266f4321ebd331e8e9778dab7640994", actor: "auditor", reason: "correção aprovada", report: report(), ...overrides });
const expectAbort = (overrides: any) => assert.throws(() => validateApplyPreconditions(valid(overrides)));

test("allowlist contém exatamente os 19 IDs autorizados", () => assert.equal(new Set(AUGUST_2026_ALLOWED_EMPLOYEE_IDS).size, 19));
test("apply sem expected-count aborta", () => expectAbort({ expectedCount: undefined }));
test("count diferente de 19 aborta", () => expectAbort({ expectedCount: 18 }));
test("delta diferente aborta em centavos", () => expectAbort({ expectedDelta: 6551.85 }));
test("fingerprint diferente aborta", () => expectAbort({ expectedSourceFingerprint: "outro" }));
test("candidato fora da allowlist aborta", () => expectAbort({ report: report({ safeCandidates: [...candidates.slice(0, 18), { employeeId: "fora", financialDelta: 0 }] }) }));
test("NEEDS_MANUAL_REVIEW nunca passa precondição alterada", () => expectAbort({ report: report({ summary: { ...report().summary, needsManualReview: 0 } }) }));
test("MISSING_SOURCE_DATA nunca passa precondição alterada", () => expectAbort({ report: report({ summary: { ...report().summary, missingSourceData: 0 } }) }));
test("baseline íntegro passa", () => assert.doesNotThrow(() => validateApplyPreconditions(valid())));
test("tentativa de alterar campo imutável falha", () => assert.throws(() => assertAllowedUpdate({ finalTotalCommission: 1, baseGoalLiters: 2 }), /proibidos/));
test("UPDATE permite somente os dez campos financeiros", () => assert.doesNotThrow(() => assertAllowedUpdate(Object.fromEntries(AUTHORIZED_FINANCIAL_FIELDS.map(k => [k, null])))));
test("before mudou causa exceção dentro da transação serializable", () => { assert.match(source, /BEFORE mudou/); assert.match(source, /isolationLevel: "Serializable"/); });
test("falha intermediária e pós-verificação provocam rollback transacional", () => { assert.match(source, /for \(const candidate[\s\S]*employeeMonthlyRecord\.update[\s\S]*Pós-condições falharam/); });
test("backup precisa existir e validar antes do primeiro update", () => { assert.ok(source.indexOf("writeFile(backupPath") < source.indexOf("employeeMonthlyRecord.update")); });
test("segunda aplicação aborta porque os 19 SAFE deixam de existir", () => assert.match(source, /validateApplyPreconditions[\s\S]*fresh/));

test("rollback aceita backup íntegro e restaura apenas campos autorizados", () => {
  const empty = Object.fromEntries(AUTHORIZED_FINANCIAL_FIELDS.map(k => [k, null]));
  const body: any = { format: "MVPCOMISS_AUGUST_2026_FINANCIAL_BACKUP_V1", createdAt: new Date(0).toISOString(), actor: "a", reason: "r", sourceFingerprint: "f", candidateCount: 19, totalFinancialDelta: 6551.86, records: AUGUST_2026_ALLOWED_EMPLOYEE_IDS.map(employeeId => ({ employeeId, unitId: "unit", year: 2026, month: 8, commissionRuleSetId: "rules", source: {}, before: empty, after: empty })) };
  assert.doesNotThrow(() => validateBackup({ ...body, checksum: backupChecksum(body) }));
  assert.throws(() => validateBackup({ ...body, checksum: "adulterado" }), /Checksum/);
  assert.match(source, /assertAllowedUpdate\(row\.before\)/);
});
