import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../scripts/audit-historical-commissions.ts", import.meta.url), "utf8");

test("auditoria histórica é protegida por transação read-only e rejeita apply", () => {
  assert.match(source, /SET TRANSACTION READ ONLY/);
  assert.match(source, /SHOW transaction_read_only/);
  assert.match(source, /includes\("--apply"\).*read-only/s);
});

test("auditoria histórica não contém operações Prisma de escrita", () => {
  for (const operation of ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"]) {
    assert.doesNotMatch(source, new RegExp(`(?:employeeMonthlyRecord|unitMonthlyMetric|commissionRuleSet)\\.${operation}\\s*\\(`));
  }
});

test("auditoria cobre classificações, campos financeiros e invariantes solicitados", () => {
  for (const token of [
    "MATCH", "MISMATCH_DERIVED_FIELDS", "MISSING_RULESET", "MISSING_SOURCE_DATA", "INVALID_SOURCE_DATA", "UNSAFE_TO_RECALCULATE",
    "baseGoalLiters", "baseStockGoal", "soldLiters", "soldStock", "stockCommission", "dobras", "employmentType",
    "employeeShift", "closedAt", "commissionRuleSetId", "totalCommission", "finalTotalCommission",
    "beforeFingerprint", "afterFingerprint",
  ]) assert.match(source, new RegExp(token));
});
