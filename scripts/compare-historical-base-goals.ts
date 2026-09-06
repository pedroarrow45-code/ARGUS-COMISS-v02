import { PrismaClient } from "@prisma/client";

const YEAR = 2026;
const MONTHS = [3, 4, 5, 6, 7, 8] as const;

type Classification =
  | "RESTORE_CANDIDATE"
  | "ALREADY_VALID"
  | "CURRENT_POSITIVE_DIFF"
  | "NO_HISTORICAL_SOURCE"
  | "MISSING_IN_CURRENT"
  | "RECORD_MISMATCH";

type Counts = Record<Classification, number>;

function emptyCounts(): Counts {
  return {
    RESTORE_CANDIDATE: 0,
    ALREADY_VALID: 0,
    CURRENT_POSITIVE_DIFF: 0,
    NO_HISTORICAL_SOURCE: 0,
    MISSING_IN_CURRENT: 0,
    RECORD_MISMATCH: 0,
  };
}

function increment(map: Map<string, Counts>, key: string, classification: Classification) {
  const counts = map.get(key) ?? emptyCounts();
  counts[classification] += 1;
  map.set(key, counts);
}

function positive(value: { toString(): string } | null | undefined) {
  return value != null && Number(value.toString()) > 0;
}

function decimal(value: { toString(): string } | null | undefined) {
  return value == null ? null : value.toString();
}

async function main() {
  const currentUrl = process.env.DATABASE_URL?.trim();
  const historicalUrl = process.env.HISTORICAL_DATABASE_URL?.trim();
  if (!currentUrl || !historicalUrl) {
    throw new Error("DATABASE_URL e HISTORICAL_DATABASE_URL são obrigatórias.");
  }
  if (currentUrl === historicalUrl) {
    throw new Error("ABORTADO: CURRENT e HISTORICAL apontam para o mesmo banco.");
  }

  // Clientes independentes; URLs e credenciais jamais são incluídas na saída.
  const current = new PrismaClient({ datasourceUrl: currentUrl });
  const historical = new PrismaClient({ datasourceUrl: historicalUrl });

  try {
    const where = { year: YEAR, month: { in: [...MONTHS] } };
    const [historicalRecords, currentRecords] = await Promise.all([
      historical.employeeMonthlyRecord.findMany({
        where,
        // O snapshot historico pode ter schema mais antigo: nunca deixe o
        // Prisma selecionar implicitamente todos os campos do model atual.
        select: {
          id: true,
          employeeId: true,
          unitId: true,
          year: true,
          month: true,
          employmentType: true,
          baseGoalLiters: true,
          finalGoalLiters: true,
          unit: { select: { name: true } },
          employee: { select: { name: true } },
        },
        orderBy: [{ year: "asc" }, { month: "asc" }, { unitId: "asc" }, { employeeId: "asc" }],
      }),
      current.employeeMonthlyRecord.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          unitId: true,
          year: true,
          month: true,
          baseGoalLiters: true,
        },
      }),
    ]);

    const currentById = new Map(currentRecords.map((record) => [record.id, record]));
    const totals = emptyCounts();
    const byMonth = new Map<string, Counts>();
    const byUnit = new Map<string, Counts>();

    for (const historicalRecord of historicalRecords) {
      const currentRecord = currentById.get(historicalRecord.id);
      const source = positive(historicalRecord.baseGoalLiters)
        ? historicalRecord.baseGoalLiters
        : positive(historicalRecord.finalGoalLiters) ? historicalRecord.finalGoalLiters : null;

      let classification: Classification;
      if (!currentRecord) {
        classification = "MISSING_IN_CURRENT";
      } else if (
        currentRecord.employeeId !== historicalRecord.employeeId
        || currentRecord.unitId !== historicalRecord.unitId
        || currentRecord.year !== historicalRecord.year
        || currentRecord.month !== historicalRecord.month
      ) {
        classification = "RECORD_MISMATCH";
      } else if (!source) {
        classification = "NO_HISTORICAL_SOURCE";
      } else if (!positive(currentRecord.baseGoalLiters)) {
        classification = "RESTORE_CANDIDATE";
      } else if (currentRecord.baseGoalLiters.equals(source)) {
        classification = "ALREADY_VALID";
      } else {
        classification = "CURRENT_POSITIVE_DIFF";
      }

      totals[classification] += 1;
      increment(byMonth, `${historicalRecord.year}-${String(historicalRecord.month).padStart(2, "0")}`, classification);
      increment(byUnit, historicalRecord.unit.name, classification);
      console.log(JSON.stringify({
        UNIT: historicalRecord.unit.name,
        EMPLOYEE: historicalRecord.employee.name,
        YEAR: historicalRecord.year,
        MONTH: historicalRecord.month,
        EMPLOYMENT_TYPE: historicalRecord.employmentType,
        CURRENT_BASE: decimal(currentRecord?.baseGoalLiters),
        HISTORICAL_BASE: decimal(historicalRecord.baseGoalLiters),
        HISTORICAL_FINAL: decimal(historicalRecord.finalGoalLiters),
        SOURCE_BASE: decimal(source),
        CLASSIFICATION: classification,
      }));
    }

    console.log("\nSUMMARY");
    console.table({
      totalHistorical: historicalRecords.length,
      restoreCandidates: totals.RESTORE_CANDIDATE,
      alreadyValid: totals.ALREADY_VALID,
      currentPositiveDiff: totals.CURRENT_POSITIVE_DIFF,
      noHistoricalSource: totals.NO_HISTORICAL_SOURCE,
      missingInCurrent: totals.MISSING_IN_CURRENT,
      recordMismatch: totals.RECORD_MISMATCH,
    });
    console.log("\nSUMMARY_BY_MONTH");
    console.table(Object.fromEntries(byMonth));
    console.log("\nSUMMARY_BY_UNIT");
    console.table(Object.fromEntries(byUnit));
  } finally {
    await Promise.all([current.$disconnect(), historical.$disconnect()]);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha desconhecida na comparação.");
  process.exitCode = 1;
});
