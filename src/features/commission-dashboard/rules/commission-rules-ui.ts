import type { CommissionRuleSetChangeInput, CommissionRuleSetDto } from "./manage-commission-rules";

export type CommissionRulesDraft = Record<keyof CommissionRuleSetChangeInput, string>;
const percent = (factor: number) => String(Number((factor * 100).toFixed(4)));

export function commissionRulesToDraft(rule: CommissionRuleSetDto, effectiveYear: number, effectiveMonth: number): CommissionRulesDraft {
  return {
    effectiveYear: String(effectiveYear), effectiveMonth: String(effectiveMonth),
    permanentDaytimeRate: rule.permanentDaytimeRate.toFixed(4), permanentNighttimeRate: rule.permanentNighttimeRate.toFixed(4),
    probationDaytimeRate: rule.probationDaytimeRate.toFixed(4), probationNighttimeRate: rule.probationNighttimeRate.toFixed(4),
    probationGoalFactor: percent(rule.probationGoalFactor), minimumEligibilityPercentage: String(rule.minimumEligibilityPercentage), neutralMultiplier: String(rule.neutralMultiplier),
    greenThreshold: String(rule.greenThreshold), greenMultiplier: String(rule.greenMultiplier),
    blueThreshold: String(rule.blueThreshold), blueMultiplier: String(rule.blueMultiplier), teamBonusFactor: percent(rule.teamBonusFactor),
  };
}

export function commissionRulesDraftToInput(draft: CommissionRulesDraft): CommissionRuleSetChangeInput {
  return {
    effectiveYear: Number(draft.effectiveYear), effectiveMonth: Number(draft.effectiveMonth),
    permanentDaytimeRate: Number(draft.permanentDaytimeRate), permanentNighttimeRate: Number(draft.permanentNighttimeRate),
    probationDaytimeRate: Number(draft.probationDaytimeRate), probationNighttimeRate: Number(draft.probationNighttimeRate),
    probationGoalFactor: Number(draft.probationGoalFactor) / 100, minimumEligibilityPercentage: 70, neutralMultiplier: Number(draft.neutralMultiplier),
    greenThreshold: Number(draft.greenThreshold), greenMultiplier: Number(draft.greenMultiplier),
    blueThreshold: Number(draft.blueThreshold), blueMultiplier: Number(draft.blueMultiplier),
    teamBonusFactor: Number(draft.teamBonusFactor) / 100,
  };
}

export function ruleSetToComparableInput(rule: CommissionRuleSetDto): CommissionRuleSetChangeInput {
  const { id: _id, version: _version, status: _status, validFrom: _validFrom, validUntil: _validUntil, ...input } = rule;
  return input;
}

export function nextCompetence(date = new Date()) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 };
}

export function findScheduledRule(history: CommissionRuleSetDto[], date = new Date()) {
  const reference = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).getTime();
  return [...history].filter((rule) => Date.parse(rule.validFrom) > reference).sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0] ?? null;
}

export function friendlyCommissionRulesError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/fechada/i.test(message)) return "Não é possível alterar as regras a partir desta competência porque já existem unidades fechadas nesse período.";
  if (/concorrente|P2002|P2034/i.test(message)) return "Outra alteração foi realizada enquanto esta tela estava aberta. Atualize os dados e tente novamente.";
  if (/sobrepõe|sobreposi/i.test(message)) return "Já existe uma configuração programada para esta competência.";
  return message || "Não foi possível criar a nova versão. Revise os valores e tente novamente.";
}
