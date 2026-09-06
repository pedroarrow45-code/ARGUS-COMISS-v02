function state() {
  const current = globalThis.__commissionPrismaMock;
  if (!current) throw new Error("Commission Prisma mock was not configured for this test.");
  return current;
}

export const prisma = {
  commissionRuleSet: {
    findUnique: (...args) => state().commissionRuleSet?.findUnique(...args),
    findMany: (...args) => state().commissionRuleSet?.findMany(...args) ?? Promise.resolve([{
      id: "00000000-0000-4000-8000-000000000001", version: 1,
      daytimePermanentRate: 0.01, nighttimePermanentRate: 0.03,
      daytimeProbationRate: 0.0075, nighttimeProbationRate: 0.02,
      probationGoalFactor: 0.7, minimumEligibilityPercentage: 100, neutralMultiplier: 1,
      greenMinimumPercentage: 105, greenMultiplier: 1.15,
      blueMinimumPercentage: 135, blueMultiplier: 1.25, teamBonusRate: 0.05,
    }]),
  },
  unit: {
    findUnique: (...args) => state().unit.findUnique(...args),
    findMany: (...args) => state().unit.findMany(...args),
    findFirst: (...args) => state().unit.findFirst(...args),
  },
  employee: {
    findMany: (...args) => state().employee.findMany(...args),
    count: (...args) => state().employee.count(...args),
  },
  unitMonthlyMetric: {
    findUnique: (...args) => state().unitMonthlyMetric.findUnique(...args),
    findMany: (...args) => state().unitMonthlyMetric.findMany(...args),
    aggregate: (...args) => state().unitMonthlyMetric.aggregate(...args),
    update: (...args) => state().unitMonthlyMetric.update(...args),
  },
  employeeMonthlyRecord: {
    findFirst: (...args) => state().employeeMonthlyRecord.findFirst(...args),
    findMany: (...args) => state().employeeMonthlyRecord.findMany(...args),
    aggregate: (...args) => state().employeeMonthlyRecord.aggregate(...args),
    groupBy: (...args) => state().employeeMonthlyRecord.groupBy(...args),
    update: (...args) => state().employeeMonthlyRecord.update(...args),
    updateMany: (...args) => state().employeeMonthlyRecord.updateMany(...args),
    createMany: (...args) => state().employeeMonthlyRecord.createMany(...args),
  },
  $transaction: (...args) => state().$transaction(...args),
};
