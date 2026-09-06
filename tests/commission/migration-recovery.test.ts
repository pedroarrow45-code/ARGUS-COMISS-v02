import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationPath = new URL(
  "../../prisma/migrations/20260904130000_remove_probation_eligibility_floor/migration.sql",
  import.meta.url,
);

test("migration de recuperação é reexecutável e não altera regras históricas", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "baseStockGoal"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "effectiveStockGoal"/);
  assert.match(sql, /WHERE "baseStockGoal" IS NULL/);
  assert.doesNotMatch(sql, /UPDATE "commission_rule_sets"/);
  assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE)\b/i);
});
