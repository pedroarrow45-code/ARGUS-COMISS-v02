import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const YEAR = 2026;
const MONTH = 5;
const apply = process.argv.includes("--apply");

async function main() {
  const [unitsToClean, employeesToClean, mayUnitMetrics] = await Promise.all([
    prisma.unitMonthlyMetric.findMany({
      where: {
        year: YEAR,
        month: MONTH,
        OR: [{ resultLiters: { not: null } }, { resultStock: { not: null } }, { resultAmount: { not: 0 } }],
      },
      select: {
        id: true,
        unitId: true,
        resultLiters: true,
        resultStock: true,
        resultAmount: true,
        goalAmount: true,
        goalLiters: true,
        goalStock: true,
      },
    }),
    prisma.employeeMonthlyRecord.findMany({
      where: {
        year: YEAR,
        month: MONTH,
        OR: [
          { soldLiters: { not: 0 } },
          { soldStock: { not: null } },
          { abastecimento: { not: 0 } },
          { baseCommission: { not: null } },
          { bonusAmount: { not: null } },
          { totalCommission: { not: null } },
          { finalTotalCommission: { not: null } },
        ],
      },
      select: {
        id: true,
        employeeId: true,
        unitId: true,
        soldLiters: true,
        soldStock: true,
        abastecimento: true,
        baseCommission: true,
        bonusAmount: true,
        totalCommission: true,
        finalTotalCommission: true,
        baseGoalLiters: true,
        finalGoalLiters: true,
        stockGoalCommission: true,
      },
    }),
    prisma.unitMonthlyMetric.findMany({
      where: { year: YEAR, month: MONTH },
      select: { id: true, unitId: true, goalLiters: true, goalStock: true },
    }),
  ]);

  const unitIds = mayUnitMetrics.map((metric) => metric.unitId);
  const aprilByUnitId = new Map(
    (
      await prisma.unitMonthlyMetric.findMany({
        where: { year: 2026, month: 4, unitId: { in: unitIds } },
        select: { unitId: true, goalLiters: true, goalStock: true },
      })
    ).map((metric) => [metric.unitId, metric]),
  );

  type UnitMetaFallbackTarget = {
    id: string;
    nextGoalLiters: typeof mayUnitMetrics[number]["goalLiters"];
    nextGoalStock: typeof mayUnitMetrics[number]["goalStock"];
  };

  const unitMetaFallbackTargets: UnitMetaFallbackTarget[] = [];
  for (const mayMetric of mayUnitMetrics) {
      const aprilMetric = aprilByUnitId.get(mayMetric.unitId);
      if (!aprilMetric) continue;

      const mayGoalLiters = mayMetric.goalLiters !== null ? Number(mayMetric.goalLiters) : 0;
      const mayGoalStock = mayMetric.goalStock !== null ? Number(mayMetric.goalStock) : 0;
      const aprilGoalLiters = aprilMetric.goalLiters !== null ? Number(aprilMetric.goalLiters) : 0;
      const aprilGoalStock = aprilMetric.goalStock !== null ? Number(aprilMetric.goalStock) : 0;

      const nextGoalLiters = mayGoalLiters <= 0 && aprilGoalLiters > 0 ? aprilMetric.goalLiters : null;
      const nextGoalStock = mayGoalStock <= 0 && aprilGoalStock > 0 ? aprilMetric.goalStock : null;

      if (nextGoalLiters === null && nextGoalStock === null) continue;
      unitMetaFallbackTargets.push({ id: mayMetric.id, nextGoalLiters, nextGoalStock });
  }

  console.log("[DRY-RUN] Registros alvo em Maio/2026");
  console.log(
    JSON.stringify(
      {
        year: YEAR,
        month: MONTH,
        counts: {
          unitsWithResultToClean: unitsToClean.length,
          employeesWithResultToClean: employeesToClean.length,
          unitsWithMetaFallbackFromApril: unitMetaFallbackTargets.length,
        },
        fieldsToUpdate: {
          unitMetaFallback: ["goalLiters", "goalStock"],
          unitResultsClean: ["resultAmount", "resultLiters", "resultStock"],
          employeeResultsClean: [
            "abastecimento",
            "soldLiters",
            "soldStock",
            "baseCommission",
            "bonusAmount",
            "totalCommission",
            "finalTotalCommission",
          ],
        },
        unitsToClean,
        employeesToClean,
        unitMetaFallbackTargets,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("\nNenhuma alteração aplicada. Rode com --apply para efetivar.");
    return;
  }

  const tx = [
    prisma.unitMonthlyMetric.updateMany({
      where: { year: YEAR, month: MONTH },
      data: {
        resultLiters: 0,
        resultStock: null,
        resultAmount: 0,
      },
    }),
    prisma.employeeMonthlyRecord.updateMany({
      where: { year: YEAR, month: MONTH },
      data: {
        soldLiters: 0,
        soldStock: null,
        abastecimento: 0,
        baseCommission: 0,
        bonusAmount: 0,
        totalCommission: 0,
        finalTotalCommission: 0,
      },
    }),
    ...unitMetaFallbackTargets.map((target) =>
      prisma.unitMonthlyMetric.update({
        where: { id: target.id },
        data: {
          ...(target.nextGoalLiters !== null ? { goalLiters: target.nextGoalLiters } : {}),
          ...(target.nextGoalStock !== null ? { goalStock: target.nextGoalStock } : {}),
        },
      }),
    ),
  ];

  await prisma.$transaction(tx);

  console.log("\n[APPLY] Limpeza concluída para Maio/2026.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
