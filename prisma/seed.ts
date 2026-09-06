import {
  EmployeeShift,
  EmployeeStatus,
  EmploymentType,
  GoalSource,
  PrismaClient,
  UserRole,
} from "@prisma/client";

import { calculateCommission, type CommissionRules } from "../src/features/commission-dashboard/engine/calculate-commission";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const UNITS = [
  { code: "HZ-CENTRO", name: "Horizonte Centro", employees: 8, litersGoal: 168_740, stockGoal: 42_850, financialGoal: 612_450, profile: [1.02, 0.98, 1.04, 1.01, 1.06, 1.03, 1.01] },
  { code: "HZ-NORTE", name: "Horizonte Norte", employees: 6, litersGoal: 132_680, stockGoal: 36_920, financialGoal: 478_300, profile: [0.96, 1.01, 0.99, 1.03, 0.97, 1.02, 0.98] },
  { code: "HZ-SUL", name: "Horizonte Sul", employees: 6, litersGoal: 141_350, stockGoal: 38_760, financialGoal: 506_800, profile: [0.88, 1.07, 0.94, 1.03, 0.91, 1.08, 0.96] },
  { code: "HZ-LESTE", name: "Horizonte Leste", employees: 7, litersGoal: 157_920, stockGoal: 41_480, financialGoal: 567_240, profile: [0.92, 0.96, 1.01, 1.05, 1.08, 1.11, 1.09] },
  { code: "HZ-OESTE", name: "Horizonte Oeste", employees: 6, litersGoal: 128_460, stockGoal: 35_640, financialGoal: 459_700, profile: [0.95, 1.02, 0.93, 0.99, 1.04, 0.97, 1.00] },
  { code: "HZ-AERO", name: "Horizonte Aeroporto", employees: 9, litersGoal: 224_580, stockGoal: 58_920, financialGoal: 814_650, profile: [1.08, 1.12, 1.05, 1.16, 1.11, 1.18, 1.14] },
] as const;

const NAMES = [
  "Amanda Ribeiro", "Bruno Tavares", "Camila Nogueira", "Daniel Martins", "Elisa Cardoso", "Fábio Menezes", "Gabriela Lopes", "Henrique Duarte",
  "Isabela Freitas", "João Viana", "Karina Monteiro", "Leandro Pires", "Mariana Azevedo", "Nicolas Rocha", "Olívia Campos", "Paulo Mendes",
  "Queila Barros", "Rafael Moreira", "Sabrina Farias", "Thiago Rezende", "Úrsula Lima", "Vinícius Castro", "Wesley Moura", "Yasmin Andrade",
  "Adriana Correia", "Caio Fonseca", "Débora Cunha", "Eduardo Sales", "Fernanda Brito", "Guilherme Neves", "Helena Braga", "Igor Peixoto",
  "Jéssica Coelho", "Kleber Vieira", "Larissa Paiva", "Marcelo Xavier", "Natália Teixeira", "Otávio Luz", "Priscila Rangel", "Renato Assis",
  "Talita Guimarães", "Vitor Macedo",
] as const;

const LITER_RATIOS = [1.42, 1.18, 1.08, 1.01, 0.99, 0.91, 0.78, 1.36, 1.12, 1.04, 0.97, 0.84];
const STOCK_RATIOS = [1.11, 0.92, 1.38, 1.02, 0.81, 1.07, 0.74, 1.43, 0.96, 1.16, 0.88, 1.03];

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function periodFromOffset(offset: number) {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function emailFor(name: string) {
  return `${name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, ".")}@redehorizonte.demo`;
}

async function main() {
  const existingUnits = await prisma.unit.count({ where: { code: { in: UNITS.map((unit) => unit.code) } } });
  if (existingUnits === UNITS.length) {
    console.log("Demo Rede Horizonte já instalada. Nenhuma alteração realizada.");
    return;
  }
  if (await prisma.unit.count() > 0) {
    throw new Error("A instalação contém unidades. O seed de demonstração só pode ser aplicado a uma base operacional vazia.");
  }

  const demoPassword = process.env.DEMO_ADMIN_PASSWORD;
  if (!demoPassword || demoPassword.length < 8) {
    throw new Error("Defina DEMO_ADMIN_PASSWORD com pelo menos 8 caracteres para instalar a demonstração.");
  }

  const activeRuleSet = await prisma.commissionRuleSet.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { validFrom: "desc" },
  });
  if (!activeRuleSet) throw new Error("Nenhum conjunto de regras ativo foi encontrado.");
  const demoRules: CommissionRules = {
    rates: {
      DAYTIME: { PERMANENT: activeRuleSet.daytimePermanentRate.toNumber(), PROBATION: activeRuleSet.daytimeProbationRate.toNumber() },
      NIGHTTIME: { PERMANENT: activeRuleSet.nighttimePermanentRate.toNumber(), PROBATION: activeRuleSet.nighttimeProbationRate.toNumber() },
    },
    probationGoalFactor: activeRuleSet.probationGoalFactor.toNumber(),
    minimumEligibilityPercentage: activeRuleSet.minimumEligibilityPercentage.toNumber(),
    teamBonusRate: activeRuleSet.teamBonusRate.toNumber(),
    zones: {
      neutralMultiplier: activeRuleSet.neutralMultiplier.toNumber(),
      greenMinimumPercentage: activeRuleSet.greenMinimumPercentage.toNumber(),
      greenMultiplier: activeRuleSet.greenMultiplier.toNumber(),
      blueMinimumPercentage: activeRuleSet.blueMinimumPercentage.toNumber(),
      blueMultiplier: activeRuleSet.blueMultiplier.toNumber(),
    },
  };

  const demoPasswordHash = await hashPassword(demoPassword);
  await prisma.user.upsert({
    where: { email: "demo@arguscomiss.com.br" },
    create: {
      name: "Demonstração ARGUS",
      email: "demo@arguscomiss.com.br",
      passwordHash: demoPasswordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
    update: {
      name: "Demonstração ARGUS",
      passwordHash: demoPasswordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  let employeeIndex = 0;
  let totalRecords = 0;

  for (const [unitIndex, spec] of UNITS.entries()) {
    const unit = await prisma.unit.create({ data: { name: spec.name, code: spec.code, isActive: true } });
    const employees = [];

    for (let localIndex = 0; localIndex < spec.employees; localIndex += 1) {
      const name = NAMES[employeeIndex];
      const isInactive = [14, 34, 40].includes(employeeIndex);
      const isProbation = [5, 11, 20, 28, 37, 41].includes(employeeIndex);
      const isTransition = [3, 18, 31].includes(employeeIndex);
      const shift = localIndex >= Math.ceil(spec.employees * 0.62) ? EmployeeShift.NIGHTTIME : EmployeeShift.DAYTIME;
      const admissionOffset = isProbation ? -2 : isTransition ? -5 : -(10 + ((employeeIndex * 7) % 38));
      const admissionPeriod = periodFromOffset(admissionOffset);
      const admissionDate = new Date(Date.UTC(admissionPeriod.year, admissionPeriod.month - 1, 3 + (employeeIndex % 21)));

      employees.push(await prisma.employee.create({
        data: {
          unitId: unit.id,
          name,
          email: emailFor(name),
          document: String(710_000_000_00 + employeeIndex * 7_913),
          status: isInactive ? EmployeeStatus.INACTIVE : EmployeeStatus.ACTIVE,
          shift,
          employmentType: isProbation ? EmploymentType.PROBATION : EmploymentType.PERMANENT,
          admissionDate,
          eligibleForCommission: true,
        },
      }));
      employeeIndex += 1;
    }

    for (let periodIndex = 0; periodIndex < 7; periodIndex += 1) {
      const offset = periodIndex - 6;
      const period = periodFromOffset(offset);
      const isClosed = offset < 0;
      const unitRatio = spec.profile[periodIndex];
      const seasonalFactor = 1 + ((period.month % 4) - 1.5) * 0.008;
      const goalLiters = round(spec.litersGoal * seasonalFactor, 3);
      const goalStock = round(spec.stockGoal * (1 + ((periodIndex + unitIndex) % 3 - 1) * 0.018));
      const resultLiters = round(goalLiters * unitRatio, 3);
      const resultStock = round(goalStock * (unitRatio + (unitIndex === 1 ? -0.09 : (periodIndex % 3 - 1) * 0.035)));
      const financialRatio = unitRatio + ((unitIndex + periodIndex) % 4 - 1.5) * 0.012;

      await prisma.unitMonthlyMetric.create({
        data: {
          unitId: unit.id,
          year: period.year,
          month: period.month,
          goalAmount: round(spec.financialGoal * seasonalFactor),
          resultAmount: round(spec.financialGoal * financialRatio),
          goalLiters,
          resultLiters,
          goalStock,
          resultStock,
          notes: isClosed ? "Competência consolidada para demonstração." : "Competência em acompanhamento.",
          closedAt: isClosed ? new Date(Date.UTC(period.year, period.month, 0, 20, 0, 0)) : null,
          commissionRuleSetId: isClosed ? activeRuleSet.id : null,
        },
      });

      const baseGoal = goalLiters / employees.length;
      const baseStockGoal = goalStock / employees.length;
      const rawLiterWeights = employees.map((_, index) => LITER_RATIOS[(employeeIndex + index + periodIndex) % LITER_RATIOS.length]);
      const weightTotal = rawLiterWeights.reduce((sum, value) => sum + value, 0);
      const unitMetGoal = resultLiters >= goalLiters;

      for (const [index, employee] of employees.entries()) {
        const employeeNumber = employeeIndex - employees.length + index;
        const inactiveBeforeCurrent = employee.status === EmployeeStatus.INACTIVE && periodIndex >= 5;
        const hiredAfterPeriod = employee.admissionDate && employee.admissionDate > new Date(Date.UTC(period.year, period.month, 0));
        if (inactiveBeforeCurrent || hiredAfterPeriod) continue;

        const soldLiters = round(resultLiters * rawLiterWeights[index] / weightTotal, 3);
        const stockRatio = STOCK_RATIOS[(employeeNumber + periodIndex * 2) % STOCK_RATIOS.length];
        const soldStock = round(baseStockGoal * stockRatio);
        const stockCommission = round(soldStock * 0.0325);
        const dobras = (employeeNumber + periodIndex) % 9 === 0 ? round(18 + employeeNumber * 0.73) : 0;
        const monthsSinceAdmission = employee.admissionDate
          ? (period.year - employee.admissionDate.getUTCFullYear()) * 12 + period.month - (employee.admissionDate.getUTCMonth() + 1)
          : 12;
        const periodEmploymentType = monthsSinceAdmission < 3 ? EmploymentType.PROBATION : employee.employmentType;
        const calculation = calculateCommission({
          employmentType: periodEmploymentType,
          employeeShift: employee.shift,
          baseGoalLiters: baseGoal,
          soldLiters,
          unitMetLitersGoal: unitMetGoal,
          soldStock,
          stockGoal: baseStockGoal,
          stockBaseCommission: stockCommission,
          dobras,
        }, demoRules);

        await prisma.employeeMonthlyRecord.create({
          data: {
            employeeId: employee.id,
            unitId: unit.id,
            year: period.year,
            month: period.month,
            employmentType: periodEmploymentType,
            employeeShift: employee.shift,
            baseGoalLiters: round(baseGoal, 3),
            finalGoalLiters: calculation.finalGoalLiters,
            goalSource: GoalSource.AUTOMATIC,
            soldLiters,
            abastecimento: Math.round(soldLiters / (31 + (employeeNumber % 9))),
            soldStock,
            stockCommission,
            stockGoalCommission: round(baseStockGoal),
            baseStockGoal: round(baseStockGoal),
            effectiveStockGoal: calculation.effectiveStockGoal,
            dobras,
            ...(isClosed ? {
              baseRate: calculation.baseRate,
              baseCommission: calculation.baseCommission,
              bonusApplied: calculation.bonusApplied,
              bonusAmount: calculation.bonusAmount,
              totalCommission: calculation.totalCommission,
              finalTotalCommission: calculation.finalTotalCommission,
              commissionEligible: calculation.eligible,
              minimumEligibilityPercentage: calculation.minimumEligibilityPercentage,
              ineligibilityReason: calculation.ineligibilityReason,
              stockMultiplier: calculation.stockMultiplier,
              litersMultiplier: calculation.litersMultiplier,
            } : {}),
          },
        });
        totalRecords += 1;
      }
    }
  }

  console.log("Demo ARGUS COMISS instalada com sucesso.");
  console.log(`  Rede: Rede Horizonte Combustíveis`);
  console.log(`  Unidades: ${UNITS.length}`);
  console.log(`  Funcionários: ${NAMES.length}`);
  console.log("  Competências: 6 fechadas + atual aberta");
  console.log(`  Resultados mensais: ${totalRecords}`);
}

main()
  .catch((error) => {
    console.error("Erro ao instalar demonstração:", error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
