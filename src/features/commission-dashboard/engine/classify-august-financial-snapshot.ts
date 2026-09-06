import { roundCommission, type CommissionCalculationBreakdown } from "./calculate-commission";

export type AugustFinancialClassification =
  | "FINANCIAL_MATCH" | "FINANCIAL_MATCH_UI_ONLY" | "SAFE_KNOWN_FINANCIAL_BUG"
  | "NEEDS_MANUAL_REVIEW" | "MISSING_SOURCE_DATA" | "INVALID_SOURCE_DATA" | "UNSAFE";

export type AugustFinancialSnapshot = {
  unitName: string;
  employmentType: "PERMANENT" | "PROBATION";
  commissionRuleSetId: string | null;
  sourceComplete: boolean;
  sourceValid: boolean;
  deterministic: boolean;
  persisted: { baseCommission: number | null; litersMultiplier: number | null; stockMultiplier: number | null; totalCommission: number | null; finalTotalCommission: number | null };
  expected: CommissionCalculationBreakdown | null;
};

export function classifyAugustFinancialSnapshot(snapshot: AugustFinancialSnapshot): {
  classification: AugustFinancialClassification;
  technicalReason: string;
  financialDelta: number | null;
} {
  if (!snapshot.sourceComplete) return { classification: "MISSING_SOURCE_DATA", technicalReason: "Dados-fonte necessários ausentes.", financialDelta: null };
  if (!snapshot.sourceValid) return { classification: "INVALID_SOURCE_DATA", technicalReason: "Dados-fonte inválidos.", financialDelta: null };
  if (!snapshot.commissionRuleSetId || !snapshot.deterministic || !snapshot.expected) return { classification: "UNSAFE", technicalReason: "Regra histórica ou cálculo determinístico indisponível.", financialDelta: null };
  if (snapshot.persisted.finalTotalCommission == null) return { classification: "NEEDS_MANUAL_REVIEW", technicalReason: "Total financeiro oficial não persistido.", financialDelta: null };

  const delta = roundCommission(snapshot.expected.finalTotalCommission - snapshot.persisted.finalTotalCommission);
  if (delta === 0) {
    const uiOnly = snapshot.persisted.totalCommission !== snapshot.persisted.finalTotalCommission;
    return { classification: uiOnly ? "FINANCIAL_MATCH_UI_ONLY" : "FINANCIAL_MATCH", technicalReason: uiOnly ? "Final oficial correto; subtotal não deve ser exibido como total final." : "Final oficial confere.", financialDelta: 0 };
  }

  const esmeraldasLitersZero = /esmeraldas/i.test(snapshot.unitName)
    && snapshot.expected.litersCommissionEligible && snapshot.expected.totalCommission > 0
    && snapshot.persisted.baseCommission === 0 && snapshot.persisted.litersMultiplier === 0
    && snapshot.persisted.totalCommission === 0;
  if (esmeraldasLitersZero) return { classification: "SAFE_KNOWN_FINANCIAL_BUG", technicalReason: "AUG_ESMERALDAS_LITERS_ZERO", financialDelta: delta };

  const probationMultiplier = snapshot.employmentType === "PROBATION"
    && (snapshot.expected.litersMultiplier > 1 || snapshot.expected.stockMultiplier > 1)
    && (snapshot.persisted.litersMultiplier !== snapshot.expected.litersMultiplier
      || snapshot.persisted.stockMultiplier !== snapshot.expected.stockMultiplier);
  if (probationMultiplier) return { classification: "SAFE_KNOWN_FINANCIAL_BUG", technicalReason: "AUG_PROBATION_MULTIPLIER_SNAPSHOT", financialDelta: delta };

  return { classification: "NEEDS_MANUAL_REVIEW", technicalReason: "Divergência financeira sem padrão conhecido inequívoco.", financialDelta: delta };
}
