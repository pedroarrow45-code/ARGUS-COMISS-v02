import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source = readFileSync(new URL("../../scripts/audit-august-2026-financial.ts", import.meta.url), "utf8");
test("script é agosto fixo e separa dry-run de apply controlado", () => { assert.match(source, /year: 2026, month: 8/); assert.match(source, /includes\("--dry-run"\)/); assert.match(source, /includes\("--apply"\)/); assert.match(source, /expected-count/); });
test("dry-run confirma read-only e apply fica em modo separado", () => { assert.match(source, /SET TRANSACTION READ ONLY/); assert.match(source, /SHOW transaction_read_only/); assert.match(source, /if \(process\.argv\.includes\("--dry-run"\)\)[\s\S]*return;[\s\S]*validateApplyPreconditions/); });
test("relatório prova invariantes e fingerprints", () => { for (const field of ["writes: 0", "immutableFieldsChanged: 0", "recordsCreated: 0", "recordsDeleted: 0", "monthsReopened: 0", "rulesChanged: 0", "goalsChanged: 0", "sourceFingerprintBefore", "sourceFingerprintAfter"]) assert.match(source, new RegExp(field)); });
test("invariantes nullable do Prisma abortam explicitamente antes do uso", () => { assert.match(source, /if \(!m\) throw new Error/); assert.match(source, /if \(!m\.closedAt\) throw new Error/); assert.doesNotMatch(source, /metricByUnit\.get\(r\.unitId\)!/); });
