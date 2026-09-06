import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const scriptUrl = new URL("../../scripts/compare-historical-base-goals.ts", import.meta.url);

test("comparador histórico contém somente leituras Prisma", async () => {
  const source = await readFile(scriptUrl, "utf8");
  assert.match(source, /new PrismaClient\(\{ datasourceUrl: currentUrl \}\)/);
  assert.match(source, /new PrismaClient\(\{ datasourceUrl: historicalUrl \}\)/);
  assert.match(source, /employeeMonthlyRecord\.findMany\s*\(/g);
  assert.doesNotMatch(source, /\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany|executeRaw|executeRawUnsafe|transaction)\s*\(/);
  assert.doesNotMatch(source, /\$(?:executeRaw|queryRaw|transaction)/);
  assert.doesNotMatch(source, /\b(?:closeMonth|reopenMonth|recalculateClosedMonth)\b/);
  assert.doesNotMatch(source, /--apply/);
});

test("comparador aborta URLs iguais e preserva o valor histórico sem aplicar fator", async () => {
  const source = await readFile(scriptUrl, "utf8");
  assert.match(source, /currentUrl === historicalUrl/);
  assert.match(source, /positive\(historicalRecord\.baseGoalLiters\)/);
  assert.match(source, /historicalRecord\.finalGoalLiters : null/);
  assert.doesNotMatch(source, /probationGoalFactor|0\.70|0\.7\b/);
  assert.doesNotMatch(source, /top-level await/);
  assert.match(source, /async function main\(\)/);
  for (const classification of [
    "RESTORE_CANDIDATE", "ALREADY_VALID", "CURRENT_POSITIVE_DIFF",
    "NO_HISTORICAL_SOURCE", "MISSING_IN_CURRENT", "RECORD_MISMATCH",
  ]) assert.match(source, new RegExp(`\\b${classification}\\b`));
});

test("consultas usam selects mínimos compatíveis com o schema histórico", async () => {
  const source = await readFile(scriptUrl, "utf8");
  const historicalQuery = source.match(/historical\.employeeMonthlyRecord\.findMany\(\{([\s\S]*?)\n      \}\),/)?.[1];
  const currentQuery = source.match(/current\.employeeMonthlyRecord\.findMany\(\{([\s\S]*?)\n      \}\),/)?.[1];
  assert.ok(historicalQuery, "findMany histórico deve existir");
  assert.ok(currentQuery, "findMany atual deve existir");
  assert.match(historicalQuery, /select:\s*\{/);
  assert.match(currentQuery, /select:\s*\{/);
  for (const field of ["id", "employeeId", "unitId", "year", "month", "employmentType", "baseGoalLiters", "finalGoalLiters"]) {
    assert.match(historicalQuery, new RegExp(`\\b${field}: true`));
  }
  for (const field of ["id", "employeeId", "unitId", "year", "month", "baseGoalLiters"]) {
    assert.match(currentQuery, new RegExp(`\\b${field}: true`));
  }
  for (const forbiddenField of ["baseStockGoal", "effectiveStockGoal", "minimumEligibilityPercentage"]) {
    assert.doesNotMatch(historicalQuery, new RegExp(`\\b${forbiddenField}\\b`));
    assert.doesNotMatch(currentQuery, new RegExp(`\\b${forbiddenField}\\b`));
  }
});
