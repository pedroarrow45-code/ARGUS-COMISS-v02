import { PrismaClient, type Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { calculateCommission } from "../src/features/commission-dashboard/engine/calculate-commission";
import { classifyAugustFinancialSnapshot } from "../src/features/commission-dashboard/engine/classify-august-financial-snapshot";
import { getCommissionRulesById } from "../src/features/commission-dashboard/rules/get-commission-rules";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { AUGUST_2026_ALLOWED_EMPLOYEE_IDS, AUTHORIZED_FINANCIAL_FIELDS, assertAllowedUpdate, backupChecksum, validateApplyPreconditions, validateBackup } from "../src/features/commission-dashboard/engine/august-financial-apply-guards";

const prisma = new PrismaClient();
const n = (v: any): number | null => v == null ? null : typeof v === "number" ? v : v.toNumber();
const money = (v: number) => Math.round(v * 100) / 100;
const immutable = (r: any) => ({ id: r.id, employeeId: r.employeeId, unitId: r.unitId, year: r.year, month: r.month, baseGoalLiters: n(r.baseGoalLiters), baseStockGoal: n(r.baseStockGoal), stockGoalCommission: n(r.stockGoalCommission), soldLiters: n(r.soldLiters), soldStock: n(r.soldStock), stockCommission: n(r.stockCommission), abastecimento: r.abastecimento, dobras: n(r.dobras), employmentType: r.employmentType, employeeShift: r.employeeShift, periodStatus: r.periodStatus, goalSource: r.goalSource });
const hash = (records: any[], metrics: any[]) => createHash("sha256").update(JSON.stringify({ records: records.map(immutable).sort((a, b) => a.id.localeCompare(b.id)), metrics: metrics.map((m) => ({ id: m.id, closedAt: m.closedAt?.toISOString(), commissionRuleSetId: m.commissionRuleSetId, goalLiters: n(m.goalLiters) })).sort((a, b) => a.id.localeCompare(b.id)) })).digest("hex");
const protectedHash = (records: any[], metrics: any[]) => createHash("sha256").update(JSON.stringify({ records: records.map(r => ({ ...immutable(r), finalGoalLiters: n(r.finalGoalLiters), effectiveStockGoal: n(r.effectiveStockGoal), minimumEligibilityPercentage: n(r.minimumEligibilityPercentage) })).sort((a, b) => a.id.localeCompare(b.id)), metrics: metrics.map((m) => ({ id: m.id, closedAt: m.closedAt?.toISOString(), commissionRuleSetId: m.commissionRuleSetId, goalLiters: n(m.goalLiters) })).sort((a, b) => a.id.localeCompare(b.id)) })).digest("hex");
const group = (rows: any[], key: (r: any) => string) => Object.values(rows.reduce((out: any, row) => { const k = key(row); out[k] ??= { key: k, count: 0, financialDelta: 0 }; out[k].count++; out[k].financialDelta = money(out[k].financialDelta + (row.financialDelta ?? 0)); return out; }, {}));

export async function buildAugustFinancialReport(tx: Prisma.TransactionClient, readOnly = false) {
    if (readOnly) {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const ro = await tx.$queryRawUnsafe("SHOW transaction_read_only") as Array<{
  transaction_read_only: string;
}>;
      if (ro[0]?.transaction_read_only !== "on") throw new Error("READ ONLY não confirmado; auditoria abortada.");
    }
    const metrics = await tx.unitMonthlyMetric.findMany({ where: { year: 2026, month: 8, closedAt: { not: null } }, include: { unit: { select: { name: true } } } });
    const records = await tx.employeeMonthlyRecord.findMany({ where: { year: 2026, month: 8, unitId: { in: metrics.map(m => m.unitId) } }, include: { employee: { select: { name: true } }, unit: { select: { name: true } } } });
    const before = hash(records, metrics); const protectedBefore = protectedHash(records, metrics); const metricByUnit = new Map(metrics.map(m => [m.unitId, m]));
    const rules = new Map<string, Awaited<ReturnType<typeof getCommissionRulesById>>>();
    for (const id of new Set(metrics.flatMap(m => m.commissionRuleSetId ? [m.commissionRuleSetId] : []))) rules.set(id, await getCommissionRulesById(id, tx));
    const rulesFingerprint = createHash("sha256").update(JSON.stringify([...rules.entries()].sort(([a], [b]) => a.localeCompare(b)))).digest("hex");
    const soldByUnit = new Map<string, number>(); for (const r of records) soldByUnit.set(r.unitId, (soldByUnit.get(r.unitId) ?? 0) + (n(r.soldLiters) ?? 0));
    const rows = records.map(r => {
      const m = metricByUnit.get(r.unitId);
      if (!m) throw new Error(`Métrica de agosto não encontrada para a unidade ${r.unitId}; auditoria abortada.`);
      if (!m.closedAt) throw new Error(`Snapshot fechado sem closedAt para a unidade ${r.unitId}; auditoria abortada.`);
      const resolved = m.commissionRuleSetId ? rules.get(m.commissionRuleSetId) : null;
      const baseGoalLiters = n(r.baseGoalLiters); const soldLiters = n(r.soldLiters);
      const sourceComplete = (baseGoalLiters ?? 0) > 0 && soldLiters != null && !(((n(r.soldStock) ?? 0) > 0) && (n(r.stockCommission) == null || (n(r.baseStockGoal) ?? n(r.stockGoalCommission) ?? 0) <= 0));
      const values = Object.values(immutable(r)).filter(v => typeof v === "number") as number[]; const sourceValid = values.every(v => Number.isFinite(v) && v >= 0);
      let expected: ReturnType<typeof calculateCommission> | null = null;
      if (resolved && sourceComplete && sourceValid) {
        if (baseGoalLiters == null || soldLiters == null) throw new Error(`Fontes de litros incompletas para o registro ${r.id}; auditoria abortada.`);
        expected = calculateCommission({ employmentType: r.employmentType, employeeShift: r.employeeShift, baseGoalLiters, soldLiters, unitMetLitersGoal: (n(m.goalLiters) ?? 0) > 0 && (soldByUnit.get(r.unitId) ?? 0) >= (n(m.goalLiters) ?? 0), soldStock: n(r.soldStock), stockGoal: n(r.baseStockGoal) ?? n(r.stockGoalCommission), stockBaseCommission: n(r.stockCommission) ?? 0, dobras: n(r.dobras) ?? 0 }, resolved.rules);
      }
      const persisted = { baseCommission: n(r.baseCommission), litersMultiplier: n(r.litersMultiplier), stockMultiplier: n(r.stockMultiplier), totalCommission: n(r.totalCommission), finalTotalCommission: n(r.finalTotalCommission) };
      const classified = classifyAugustFinancialSnapshot({ unitName: r.unit.name, employmentType: r.employmentType, commissionRuleSetId: m.commissionRuleSetId, sourceComplete, sourceValid, deterministic: Boolean(resolved), persisted, expected });
      return { recordId: r.id, employeeId: r.employeeId, unitId: r.unitId, employeeName: r.employee.name, unit: r.unit.name, employmentType: r.employmentType, employeeShift: r.employeeShift, periodStatus: r.periodStatus, goalSource: r.goalSource, abastecimento: r.abastecimento, stockGoalCommission: n(r.stockGoalCommission), stockCommission: n(r.stockCommission), dobras: n(r.dobras), closedAt: m.closedAt.toISOString(), minimumEligibilityPercentage: n(r.minimumEligibilityPercentage), baseGoalLiters: n(r.baseGoalLiters), effectiveGoalLiters: expected?.effectiveGoalLiters ?? null, finalGoalLiters: n(r.finalGoalLiters), soldLiters: n(r.soldLiters), litersAchievement: expected?.achievementPercentage ?? null, baseStockGoal: n(r.baseStockGoal), effectiveStockGoal: expected?.effectiveStockGoal ?? null, persistedEffectiveStockGoal: n(r.effectiveStockGoal), soldStock: n(r.soldStock), stockAchievement: expected ? money(expected.stockAchievement * 100) : null, commissionRuleSetId: m.commissionRuleSetId, before: { baseRate: n(r.baseRate), commissionEligible: r.commissionEligible, ineligibilityReason: r.ineligibilityReason, baseCommission: n(r.baseCommission), litersMultiplier: n(r.litersMultiplier), stockMultiplier: n(r.stockMultiplier), bonusApplied: r.bonusApplied, bonusAmount: n(r.bonusAmount), totalCommission: n(r.totalCommission), finalTotalCommission: n(r.finalTotalCommission) }, after: expected && { baseRate: expected.baseRate, commissionEligible: expected.eligible, ineligibilityReason: expected.ineligibilityReason, baseCommission: expected.baseCommission, litersMultiplier: expected.litersMultiplier, stockMultiplier: expected.stockMultiplier, bonusApplied: expected.bonusApplied, bonusAmount: expected.bonusAmount, totalCommission: expected.totalCommission, finalTotalCommission: expected.finalTotalCommission }, ...classified };
    });
    const recordsAfter = await tx.employeeMonthlyRecord.findMany({ where: { year: 2026, month: 8, unitId: { in: metrics.map(m => m.unitId) } } }); const metricsAfter = await tx.unitMonthlyMetric.findMany({ where: { year: 2026, month: 8, closedAt: { not: null } } }); const after = hash(recordsAfter, metricsAfter); const protectedAfter = protectedHash(recordsAfter, metricsAfter); if (before !== after || protectedBefore !== protectedAfter) throw new Error("Fingerprint imutável mudou.");
    const financial = rows.filter(r => r.financialDelta != null); const safe = rows.filter(r => r.classification === "SAFE_KNOWN_FINANCIAL_BUG"); const count = (c: string) => rows.filter(r => r.classification === c).length;
    return { period: "2026-08", readOnlyConfirmed: readOnly, summary: { totalAugust: rows.length, financialMatches: count("FINANCIAL_MATCH"), financialMatchesUiOnly: count("FINANCIAL_MATCH_UI_ONLY"), financialMismatches: safe.length + count("NEEDS_MANUAL_REVIEW"), safeKnownFinancialBugs: safe.length, needsManualReview: count("NEEDS_MANUAL_REVIEW"), missingSourceData: count("MISSING_SOURCE_DATA"), invalidSourceData: count("INVALID_SOURCE_DATA"), unsafe: count("UNSAFE"), persistedFinancialTotal: money(financial.reduce((s, r) => s + (r.before.finalTotalCommission ?? 0), 0)), expectedFinancialTotal: money(financial.reduce((s, r) => s + (r.after?.finalTotalCommission ?? 0), 0)), financialDelta: money(financial.reduce((s, r) => s + (r.financialDelta ?? 0), 0)), positiveDeltaCount: financial.filter(r => (r.financialDelta ?? 0) > 0).length, positiveDeltaTotal: money(financial.filter(r => (r.financialDelta ?? 0) > 0).reduce((s, r) => s + r.financialDelta!, 0)), negativeDeltaCount: financial.filter(r => (r.financialDelta ?? 0) < 0).length, negativeDeltaTotal: money(financial.filter(r => (r.financialDelta ?? 0) < 0).reduce((s, r) => s + r.financialDelta!, 0)) }, breakdown: { byUnit: group(rows, r => r.unit), byEmploymentType: group(rows, r => r.employmentType), byClassification: group(rows, r => r.classification), byTechnicalReason: group(rows, r => r.technicalReason) }, safeCandidates: safe, invariants: { writes: 0, immutableFieldsChanged: 0, recordsCreated: 0, recordsDeleted: 0, monthsReopened: 0, rulesChanged: 0, goalsChanged: 0, sourceFingerprintBefore: before, sourceFingerprintAfter: after, protectedFingerprintBefore: protectedBefore, protectedFingerprintAfter: protectedAfter, rulesFingerprint, fingerprintsMatch: before === after && protectedBefore === protectedAfter } };
}

const cli = () => Object.fromEntries(process.argv.slice(2).filter(x => x.startsWith("--") && x.includes("=")).map(x => { const [k, ...v] = x.slice(2).split("="); return [k, v.join("=")]; }));
const derived = (row: any) => ({ baseRate: n(row.baseRate), commissionEligible: row.commissionEligible, ineligibilityReason: row.ineligibilityReason, baseCommission: n(row.baseCommission), litersMultiplier: n(row.litersMultiplier), stockMultiplier: n(row.stockMultiplier), bonusApplied: row.bonusApplied, bonusAmount: n(row.bonusAmount), totalCommission: n(row.totalCommission), finalTotalCommission: n(row.finalTotalCommission) });

async function main() {
  const args = cli(); const apply = process.argv.includes("--apply"); const rollbackPath = args["rollback-backup"];
  if (!apply && !rollbackPath && !process.argv.includes("--dry-run")) throw new Error("Informe --dry-run, --apply ou --rollback-backup=<arquivo>.");
  if ([apply, Boolean(rollbackPath), process.argv.includes("--dry-run")].filter(Boolean).length !== 1) throw new Error("Modos são mutuamente exclusivos.");
  if (process.argv.includes("--dry-run")) {
    const report = await prisma.$transaction(tx => buildAugustFinancialReport(tx, true), { isolationLevel: "RepeatableRead", timeout: 120_000 });
    console.log(JSON.stringify(report, null, 2)); return;
  }
  if (rollbackPath) { await rollback(resolve(rollbackPath)); return; }

  const report = await prisma.$transaction(tx => buildAugustFinancialReport(tx, true), { isolationLevel: "RepeatableRead", timeout: 120_000 });
  validateApplyPreconditions({ expectedCount: args["expected-count"] ? Number(args["expected-count"]) : undefined, expectedDelta: args["expected-delta"] ? Number(args["expected-delta"]) : undefined, expectedSourceFingerprint: args["expected-source-fingerprint"], actor: args.actor, reason: args.reason, report });
  const backupBody: any = { format: "MVPCOMISS_AUGUST_2026_FINANCIAL_BACKUP_V1", createdAt: new Date().toISOString(), actor: args.actor, reason: args.reason, sourceFingerprint: report.invariants.sourceFingerprintBefore, candidateCount: 19, totalFinancialDelta: 6551.86, records: report.safeCandidates.map((r: any) => ({ employeeId: r.employeeId, unitId: r.unitId, year: 2026, month: 8, commissionRuleSetId: r.commissionRuleSetId, source: { baseGoalLiters: r.baseGoalLiters, finalGoalLiters: r.finalGoalLiters, baseStockGoal: r.baseStockGoal, effectiveStockGoal: r.persistedEffectiveStockGoal, stockGoalCommission: r.stockGoalCommission, soldLiters: r.soldLiters, soldStock: r.soldStock, stockCommission: r.stockCommission, abastecimento: r.abastecimento, dobras: r.dobras, employmentType: r.employmentType, employeeShift: r.employeeShift, periodStatus: r.periodStatus, goalSource: r.goalSource, minimumEligibilityPercentage: r.minimumEligibilityPercentage, closedAt: r.closedAt }, before: derived(r.before), after: derived(r.after) })) };
  const backup = { ...backupBody, checksum: backupChecksum(backupBody) }; const backupPath = resolve(args.backup ?? `backups/august-2026-${Date.now()}.json`); await mkdir(dirname(backupPath), { recursive: true }); await writeFile(backupPath, JSON.stringify(backup, null, 2), { flag: "wx", mode: 0o600 }); validateBackup(JSON.parse(await readFile(backupPath, "utf8")));
  await prisma.$transaction(async tx => {
    const fresh = await buildAugustFinancialReport(tx); validateApplyPreconditions({ expectedCount: 19, expectedDelta: 6551.86, expectedSourceFingerprint: report.invariants.sourceFingerprintBefore, actor: args.actor, reason: args.reason, report: fresh });
    for (const candidate of fresh.safeCandidates) { const beforeValues = derived(candidate.before); const afterValues = derived(candidate.after); const data = Object.fromEntries(Object.entries(afterValues).filter(([field, value]) => JSON.stringify(value) !== JSON.stringify(beforeValues[field as keyof typeof beforeValues]))); assertAllowedUpdate(data); const current = await tx.employeeMonthlyRecord.findUnique({ where: { employeeId_year_month: { employeeId: candidate.employeeId, year: 2026, month: 8 } } }); if (!current || JSON.stringify(derived(current)) !== JSON.stringify(derived(candidate.before))) throw new Error(`BEFORE mudou: ${candidate.employeeId}`); await tx.employeeMonthlyRecord.update({ where: { id: current.id }, data }); }
    const post = await buildAugustFinancialReport(tx); const ids = new Set(AUGUST_2026_ALLOWED_EMPLOYEE_IDS); const remaining = post.safeCandidates.filter((r: any) => ids.has(r.employeeId)); if (remaining.length || post.summary.needsManualReview !== 1 || post.summary.missingSourceData !== 1 || post.invariants.sourceFingerprintBefore !== fresh.invariants.sourceFingerprintBefore || post.invariants.protectedFingerprintBefore !== fresh.invariants.protectedFingerprintBefore || post.invariants.rulesFingerprint !== fresh.invariants.rulesFingerprint) throw new Error("Pós-condições falharam; rollback automático.");
  }, { isolationLevel: "Serializable", timeout: 120_000 });
  console.log(JSON.stringify({ applied: 19, backupPath }, null, 2));
}

async function rollback(path: string) {
  const backup = JSON.parse(await readFile(path, "utf8")); validateBackup(backup);
  await prisma.$transaction(async tx => { for (const row of backup.records) { const current = await tx.employeeMonthlyRecord.findUnique({ where: { employeeId_year_month: { employeeId: row.employeeId, year: 2026, month: 8 } } }); if (!current || current.unitId !== row.unitId || JSON.stringify(derived(current)) !== JSON.stringify(row.after)) throw new Error(`Rollback inconsistente: ${row.employeeId}`); assertAllowedUpdate(row.before); await tx.employeeMonthlyRecord.update({ where: { id: current.id }, data: row.before }); } for (const row of backup.records) { const restored = await tx.employeeMonthlyRecord.findUnique({ where: { employeeId_year_month: { employeeId: row.employeeId, year: 2026, month: 8 } } }); if (!restored || JSON.stringify(derived(restored)) !== JSON.stringify(row.before)) throw new Error(`Pós-condição do rollback falhou: ${row.employeeId}`); } }, { isolationLevel: "Serializable", timeout: 120_000 });
  console.log(JSON.stringify({ rolledBack: 19 }, null, 2));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
