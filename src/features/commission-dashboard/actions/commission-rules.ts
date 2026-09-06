"use server";

import { compareCommissionRules, createCommissionRuleSetVersion, getCurrentCommissionRuleSet, listCommissionRuleSetHistory } from "../rules/manage-commission-rules";
import type { CommissionRuleSetChangeInput } from "../rules/manage-commission-rules";

export async function createCommissionRulesVersion(input: CommissionRuleSetChangeInput) {
  return createCommissionRuleSetVersion(input);
}
export async function fetchCurrentCommissionRules() { return getCurrentCommissionRuleSet(); }
export async function fetchCommissionRulesHistory() { return listCommissionRuleSetHistory(); }
export async function compareCommissionRulesAction(current: CommissionRuleSetChangeInput, next: CommissionRuleSetChangeInput) {
  return compareCommissionRules(current, next);
}
