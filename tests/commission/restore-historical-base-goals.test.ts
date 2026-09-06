import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { historicalSource, restoreAction } from "../../scripts/restore-historical-base-goals-core.ts";

const value = (text: string) => ({ toString: () => text, equals: (other: { toString(): string }) => text === other.toString() });
const historical = (base: string, final: string) => ({
  id: "record", employeeId: "employee", unitId: "unit", year: 2026, month: 8,
  baseGoalLiters: value(base), finalGoalLiters: value(final),
});
const current = (base: string) => ({
  id: "record", employeeId: "employee", unitId: "unit", year: 2026, month: 8,
  baseGoalLiters: value(base),
});

test("seleciona exatamente a base legada restaurável", () => {
  assert.equal(historicalSource(historical("0", "33000"))?.toString(), "33000");
  assert.equal(restoreAction(current("0"), historical("0", "33000")), "RESTORE");
  assert.equal(historicalSource(historical("0", "14754.342"))?.toString(), "14754.342");
  assert.equal(restoreAction(current("0"), historical("0", "14754.342")), "RESTORE");
});

test("não escreve quando base já é válida, não há fonte, há diferença positiva ou mismatch", () => {
  assert.equal(restoreAction(current("33000"), historical("33000", "33000")), "ALREADY_VALID");
  assert.equal(restoreAction(current("0"), historical("0", "0")), "NO_HISTORICAL_SOURCE");
  assert.equal(restoreAction(current("12000"), historical("33000", "33000")), "SKIP");
  assert.equal(restoreAction({ ...current("0"), employeeId: "other" }, historical("33000", "33000")), "RECORD_MISMATCH");
});

test("script limita update à coluna baseGoalLiters e mantém consultas históricas mínimas", async () => {
  const source = await readFile(new URL("../../scripts/restore-historical-base-goals.ts", import.meta.url), "utf8");
  const update = source.match(/employeeMonthlyRecord\.update\(\{([\s\S]*?)\n          \}\);/)?.[1];
  assert.ok(update);
  assert.match(update, /data:\s*\{\s*baseGoalLiters: item\.proposedBaseGoalLiters!\s*\}/);
  for (const forbidden of ["finalGoalLiters", "soldLiters", "baseStockGoal", "finalTotalCommission", "employmentType"]) {
    assert.doesNotMatch(update, new RegExp(`\\b${forbidden}\\b`));
  }
  const historicalQuery = source.match(/historical\.employeeMonthlyRecord\.findMany\(\{([\s\S]*?)\n      \}\),/)?.[1];
  assert.ok(historicalQuery);
  assert.match(historicalQuery, /select:\s*\{/);
  assert.doesNotMatch(historicalQuery, /baseStockGoal|effectiveStockGoal|minimumEligibilityPercentage/);
  assert.match(source, /async function main\(\)/);
  assert.match(source, /const apply = applyRequested && confirmed/);
  assert.ok(source.indexOf("if (apply) {") < source.indexOf("employeeMonthlyRecord.update({"));
  assert.match(source, /--confirm=\$\{CONFIRMATION\}/);
  assert.doesNotMatch(source, /\b(?:closeMonth|reopenMonth|recalculateClosedMonth)\b/);
  assert.doesNotMatch(source, /\.(?:create|createMany|updateMany|upsert|delete|deleteMany)\s*\(/);
});
