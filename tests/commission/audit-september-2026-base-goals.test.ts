import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../scripts/audit-september-2026-base-goals.ts", import.meta.url), "utf8");

test("diagnóstico é fixo em setembro e exclusivamente dry-run/read-only", () => {
  assert.match(source, /const PERIOD = \{ year: 2026, month: 9 \}/);
  assert.match(source, /SET TRANSACTION READ ONLY/);
  assert.match(source, /SHOW transaction_read_only/);
  assert.match(source, /process\.argv\.length !== 3 \|\| process\.argv\[2\] !== "--dry-run"/);
  assert.doesNotMatch(source, /employeeMonthlyRecord\.(?:update|updateMany|upsert|create|createMany|delete|deleteMany)\(/);
});

test("fonte usa somente último baseGoalLiters positivo anterior", () => {
  assert.match(source, /baseGoalLiters: \{ gt: 0 \}/);
  assert.match(source, /orderBy: \[\{ year: "desc" \}, \{ month: "desc" \}\]/);
  assert.doesNotMatch(source, /finalGoalLiters: \{ gt: 0 \}/);
});

test("relatório inclui classificações, candidatos e fingerprints imutáveis", () => {
  for (const value of [
    "VALID_POSITIVE_GOAL", "ZERO_OR_MISSING_BASE_GOAL_WITH_SAFE_SOURCE",
    "ZERO_OR_MISSING_BASE_GOAL_WITHOUT_SOURCE", "MANUAL_POSITIVE_GOAL",
    "CLOSED_OR_HISTORICAL_UNSAFE", "OTHER_ANOMALY", "candidateCount", "sourceFingerprintBefore",
    "sourceFingerprintAfter", "writes: 0",
  ]) assert.match(source, new RegExp(value));
});
