import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const scriptUrl = new URL("../../scripts/audit-commission-raw-period.ts", import.meta.url);

test("auditoria RAW usa somente operações Prisma de leitura", async () => {
  const source = await readFile(scriptUrl, "utf8");
  assert.doesNotMatch(source, /prisma\.[\s\S]*?\.(?:create|update|updateMany|upsert|delete|deleteMany|executeRawUnsafe)\s*\(/);
  assert.doesNotMatch(source, /\b(?:closeMonth|reopenMonth|recalculateClosedMonth|fetchUnitMonthlyDetail)\b/);
  assert.match(source, /employeeMonthlyRecord\.findMany\s*\(/);
  assert.match(source, /commissionRecalculationAudit\.findMany\s*\(/);
});

test("auditoria mantém RAW separado de EXPECTED e não usa reconstrução de snapshot", async () => {
  const source = await readFile(scriptUrl, "utf8");
  assert.doesNotMatch(source, /resolveGoalDisplaySnapshot|auditCommissionRecord/);
  for (const field of [
    "RAW_baseGoalLiters", "RAW_finalGoalLiters", "RAW_stockGoalCommission",
    "RAW_baseStockGoal", "RAW_effectiveStockGoal", "RAW_finalTotalCommission",
    "EXPECTED", "RAW_CLASSIFICATION",
  ]) {
    assert.match(source, new RegExp(`\\b${field}\\b`));
  }
});
