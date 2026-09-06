import { createHash } from "node:crypto";

export const AUGUST_2026_ALLOWED_EMPLOYEE_IDS = [
  "e4382d39-1758-4969-8b0a-22126e1a67d5", "a59f6f5d-3b7c-45d5-86f6-da255edc869c",
  "75fb480c-e5a5-4bbb-ace9-aa57f08685a1", "a268fc76-e647-47df-b80c-dd21276a5047",
  "dfc53dda-0b7a-4cdf-a40a-94671efc3126", "069acc1f-7f7e-4ca0-afb0-9ab98c2884a8",
  "3c7bb28e-2a80-4c79-ad4e-f57f28017965", "79348372-2f9c-4728-ab48-98cea765f4ee",
  "67fe5a44-e1b7-4076-be8e-5271be06eb76", "126ebe11-3ef9-405f-a350-a8dd169eb037",
  "b6b15762-658a-4c34-a539-f4361f875f48", "3eacb446-af53-4555-b8bb-a8a7979a19a9",
  "c00f41f7-0bcd-40cb-be41-106594e5e10b", "1ab9e2cf-6b20-4272-8d6b-6ff199660f13",
  "66a58a5d-781f-4da4-a5f0-5cab88228ee5", "cded8daf-fe8b-4e19-b6bc-207fa03a7886",
  "a16880a6-8d49-4697-8261-bd6caaef35eb", "42130b89-d6bf-4080-9a58-801a0380c825",
  "7f485bcf-ac73-40fa-bdc3-8f507ad220cf",
] as const;

export const AUTHORIZED_FINANCIAL_FIELDS = [
  "baseRate", "commissionEligible", "ineligibilityReason", "baseCommission", "litersMultiplier",
  "stockMultiplier", "bonusApplied", "bonusAmount", "totalCommission", "finalTotalCommission",
] as const;

export const CONFIRMED_AUGUST_BASELINE = {
  period: "2026-08", count: 19, deltaCents: 655_186, needsManualReview: 1,
  missingSourceData: 1, unsafe: 0, negativeDeltaCount: 0,
  sourceFingerprint: "3fb56fa50696c3d4e213f0bde1c52c758266f4321ebd331e8e9778dab7640994",
} as const;

export function cents(value: number) { return Math.round(value * 100); }

export function assertAllowedUpdate(data: Record<string, unknown>) {
  const forbidden = Object.keys(data).filter((key) => !(AUTHORIZED_FINANCIAL_FIELDS as readonly string[]).includes(key));
  if (forbidden.length) throw new Error(`UPDATE contém campos proibidos: ${forbidden.join(", ")}`);
}

export function validateApplyPreconditions(input: {
  expectedCount?: number; expectedDelta?: number; expectedSourceFingerprint?: string; actor?: string; reason?: string;
  report: any;
}) {
  for (const [name, value] of Object.entries({ expectedCount: input.expectedCount, expectedDelta: input.expectedDelta, expectedSourceFingerprint: input.expectedSourceFingerprint, actor: input.actor, reason: input.reason })) {
    if (value == null || value === "") throw new Error(`Argumento obrigatório ausente: ${name}`);
  }
  const summary = input.report.summary;
  const candidates = input.report.safeCandidates;
  const ids = candidates.map((row: any) => row.employeeId).sort();
  const allowed = [...AUGUST_2026_ALLOWED_EMPLOYEE_IDS].sort();
  const safeDeltaCents = candidates.reduce((sum: number, row: any) => sum + cents(row.financialDelta), 0);
  const checks: Array<[boolean, string]> = [
    [input.report.period === CONFIRMED_AUGUST_BASELINE.period, "competência"],
    [input.expectedCount === CONFIRMED_AUGUST_BASELINE.count, "expected-count informado"],
    [cents(input.expectedDelta!) === CONFIRMED_AUGUST_BASELINE.deltaCents, "expected-delta informado"],
    [input.expectedSourceFingerprint === CONFIRMED_AUGUST_BASELINE.sourceFingerprint, "fingerprint informado"],
    [summary.safeKnownFinancialBugs === CONFIRMED_AUGUST_BASELINE.count, "quantidade SAFE no banco"],
    [safeDeltaCents === CONFIRMED_AUGUST_BASELINE.deltaCents, "delta SAFE no banco"],
    [summary.needsManualReview === 1, "NEEDS_MANUAL_REVIEW"], [summary.missingSourceData === 1, "MISSING_SOURCE_DATA"],
    [summary.unsafe === 0, "UNSAFE"], [summary.negativeDeltaCount === 0, "deltas negativos"],
    [input.report.invariants.sourceFingerprintBefore === CONFIRMED_AUGUST_BASELINE.sourceFingerprint, "fingerprint do banco"],
    [JSON.stringify(ids) === JSON.stringify(allowed), "allowlist fechada"],
  ];
  const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
  if (failed.length) throw new Error(`Baseline não confere: ${failed.join(", ")}`);
}

export type FinancialBackup = {
  format: "MVPCOMISS_AUGUST_2026_FINANCIAL_BACKUP_V1"; createdAt: string; actor: string; reason: string;
  sourceFingerprint: string; candidateCount: number; totalFinancialDelta: number; records: any[]; checksum: string;
};

export function backupChecksum(backup: Omit<FinancialBackup, "checksum">) {
  return createHash("sha256").update(JSON.stringify(backup)).digest("hex");
}

export function validateBackup(value: any): asserts value is FinancialBackup {
  if (!value || value.format !== "MVPCOMISS_AUGUST_2026_FINANCIAL_BACKUP_V1" || value.candidateCount !== 19 || !Array.isArray(value.records) || value.records.length !== 19) throw new Error("Backup inválido.");
  const { checksum, ...body } = value;
  if (checksum !== backupChecksum(body)) throw new Error("Checksum do backup inválido.");
  const ids = value.records.map((r: any) => r.employeeId).sort();
  if (JSON.stringify(ids) !== JSON.stringify([...AUGUST_2026_ALLOWED_EMPLOYEE_IDS].sort())) throw new Error("Backup fora da allowlist.");
  for (const row of value.records) {
    if (row.year !== 2026 || row.month !== 8 || !row.unitId || !row.commissionRuleSetId) throw new Error("Identidade inválida no backup.");
    assertAllowedUpdate(row.before); assertAllowedUpdate(row.after);
  }
}
