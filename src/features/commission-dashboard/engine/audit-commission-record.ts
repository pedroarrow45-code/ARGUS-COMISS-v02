import { calculateCommission, roundCommission, type CommissionRules } from "./calculate-commission";
import { resolveGoalDisplaySnapshot } from "./commission-display-snapshot";
import type { EmployeeShift, EmploymentType } from "./types";

export type CommissionAuditRecord = {
  employeeId: string;
  employeeName: string;
  employmentType: EmploymentType;
  employeeShift: EmployeeShift;
  baseGoalLiters: number;
  finalGoalLiters: number;
  soldLiters: number;
  stockGoalCommission: number;
  baseStockGoal: number;
  effectiveStockGoal: number;
  soldStock: number;
  stockCommission: number;
  dobras: number;
  litersMultiplier: number;
  stockMultiplier: number;
  bonusAmount: number;
  totalCommission: number;
  finalTotalCommission: number;
};

export function auditCommissionRecord(record: CommissionAuditRecord, rules: CommissionRules, unitMetLitersGoal: boolean) {
  const historical = resolveGoalDisplaySnapshot({
    employmentType: record.employmentType,
    rules,
    closed: true,
    baseGoalLiters: record.baseGoalLiters,
    effectiveGoalLiters: record.finalGoalLiters,
    soldLiters: record.soldLiters,
    baseStockGoal: record.baseStockGoal,
    effectiveStockGoal: record.effectiveStockGoal,
    legacyStockGoal: record.stockGoalCommission,
    soldStock: record.soldStock,
  });
  const expected = calculateCommission({
    employmentType: record.employmentType,
    employeeShift: record.employeeShift,
    baseGoalLiters: historical.baseGoalLiters,
    soldLiters: record.soldLiters,
    unitMetLitersGoal,
    soldStock: record.soldStock || null,
    stockGoal: historical.baseStockGoal || null,
    stockBaseCommission: record.stockCommission,
    dobras: record.dobras,
  }, rules);
  const delta = roundCommission(expected.finalTotalCommission - record.finalTotalCommission);
  const multiplierMismatch = expected.litersMultiplier !== record.litersMultiplier
    || expected.stockMultiplier !== record.stockMultiplier;
  const snapshotIncomplete = historical.baseGoalLiters <= 0 || historical.effectiveGoalLiters <= 0
    || (record.stockGoalCommission > 0 && (historical.baseStockGoal <= 0 || historical.effectiveStockGoal <= 0));
  const classification = snapshotIncomplete ? "SNAPSHOT_INCOMPLETO"
    : delta !== 0 || multiplierMismatch ? "FECHAMENTO_DIVERGENTE"
      : "OK";
  return { historical, expected, delta, classification } as const;
}
