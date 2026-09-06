export type GoalValue = { toString(): string };

export type RestoreAction =
  | "RESTORE"
  | "ALREADY_VALID"
  | "NO_HISTORICAL_SOURCE"
  | "RECORD_MISMATCH"
  | "SKIP";

export type ComparableRecord = {
  id: string;
  employeeId: string;
  unitId: string;
  year: number;
  month: number;
  baseGoalLiters: GoalValue;
};

export type HistoricalRecord = ComparableRecord & {
  finalGoalLiters: GoalValue;
};

export function isPositive(value: GoalValue | null | undefined): value is GoalValue {
  return value != null && Number(value.toString()) > 0;
}

export function historicalSource(record: HistoricalRecord): GoalValue | null {
  return isPositive(record.baseGoalLiters)
    ? record.baseGoalLiters
    : isPositive(record.finalGoalLiters) ? record.finalGoalLiters : null;
}

export function sameIdentity(current: ComparableRecord, historical: HistoricalRecord) {
  return current.id === historical.id
    && current.employeeId === historical.employeeId
    && current.unitId === historical.unitId
    && current.year === historical.year
    && current.month === historical.month;
}

export function restoreAction(current: ComparableRecord | undefined, historical: HistoricalRecord): RestoreAction {
  if (!current) return "SKIP";
  if (!sameIdentity(current, historical)) return "RECORD_MISMATCH";
  const source = historicalSource(historical);
  if (!source) return "NO_HISTORICAL_SOURCE";
  if (!isPositive(current.baseGoalLiters)) return "RESTORE";
  return current.baseGoalLiters.toString() === source.toString() ? "ALREADY_VALID" : "SKIP";
}


