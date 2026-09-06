import {
  PrismaClient,
  EmployeeStatus,
  EmployeeShift,
  EmploymentType,
  GoalSource,
  UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();

/* ──────────────────────────────────────────────
   Configuração dos dados de demonstração
   ────────────────────────────────────────────── */

const UNITS = [
  { name: "Posto Centro", code: "CENTRO" },
  { name: "Posto Norte", code: "NORTE" },
  { name: "Posto Sul", code: "SUL" },
  { name: "Posto Leste", code: "LESTE" },
  { name: "Posto Oeste", code: "OESTE" },
] as const;

type UnitCode = (typeof UNITS)[number]["code"];

const EMPLOYEES: Record<UnitCode, { name: string; email: string; document: string }[]> = {
  CENTRO: [
    { name: "João Silva", email: "joao.silva@postobrasil.local", document: "10000000001" },
    { name: "Carlos Oliveira", email: "carlos.oliveira@postobrasil.local", document: "10000000002" },
    { name: "Pedro Santos", email: "pedro.santos@postobrasil.local", document: "10000000003" },
  ],
  NORTE: [
    { name: "Marcos Souza", email: "marcos.souza@postobrasil.local", document: "20000000001" },
    { name: "Lucas Pereira", email: "lucas.pereira@postobrasil.local", document: "20000000002" },
  ],
  SUL: [
    { name: "Rafael Costa", email: "rafael.costa@postobrasil.local", document: "30000000001" },
    { name: "Bruno Almeida", email: "bruno.almeida@postobrasil.local", document: "30000000002" },
  ],
  LESTE: [
    { name: "Felipe Rodrigues", email: "felipe.rodrigues@postobrasil.local", document: "40000000001" },
    { name: "Diego Fernandes", email: "diego.fernandes@postobrasil.local", document: "40000000002" },
  ],
  OESTE: [
    { name: "Gustavo Martins", email: "gustavo.martins@postobrasil.local", document: "50000000001" },
    { name: "Henrique Carvalho", email: "henrique.carvalho@postobrasil.local", document: "50000000002" },
  ],
};

/* Mês atual (março 2026) – valores do briefing */
interface MonthSpec {
  goalAmount: number;
  resultAmount: number;
  totalLiters: number;
  goalLiters: number;
}

const CURRENT_MONTH: Record<UnitCode, MonthSpec> = {
  CENTRO: { goalAmount: 450_000, resultAmount: 385_000, totalLiters: 1_653_750, goalLiters: 1_935_000 },
  NORTE:  { goalAmount: 300_000, resultAmount: 215_000, totalLiters: 985_000,   goalLiters: 1_375_000 },
  SUL:    { goalAmount: 250_000, resultAmount: 198_000, totalLiters: 750_000,   goalLiters: 950_000 },
  LESTE:  { goalAmount: 320_000, resultAmount: 290_000, totalLiters: 1_120_000, goalLiters: 1_240_000 },
  OESTE:  { goalAmount: 250_000, resultAmount: 175_000, totalLiters: 680_000,   goalLiters: 975_000 },
};

/* Distribuição de litros por funcionário dentro da unidade (pesos relativos) */
const EMPLOYEE_LITER_WEIGHTS: Record<UnitCode, number[]> = {
  CENTRO: [0.36, 0.34, 0.30],
  NORTE:  [0.53, 0.47],
  SUL:    [0.54, 0.46],
  LESTE:  [0.54, 0.46],
  OESTE:  [0.53, 0.47],
};

/* Fatores de escala para gerar histórico com crescimento gradual */
const HISTORY_MONTHS: { year: number; month: number; scale: number; notes: string }[] = [
  { year: 2025, month: 10, scale: 0.80, notes: "Início do período de acompanhamento" },
  { year: 2025, month: 11, scale: 0.85, notes: "Crescimento no fluxo" },
  { year: 2025, month: 12, scale: 0.92, notes: "Pico de fim de ano" },
  { year: 2026, month: 1,  scale: 0.88, notes: "Início de ano mais lento" },
  { year: 2026, month: 2,  scale: 0.94, notes: "Retomada comercial" },
];

const CURRENT_PERIOD = { year: 2026, month: 3 };

/* ──────────────────────────────────────────────
   Constantes do engine de comissão
   ────────────────────────────────────────────── */
const RATE_PERMANENT = 0.01;
const BONUS_MULTIPLIER = 0.05;

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/* ──────────────────────────────────────────────
   Seed principal
   ────────────────────────────────────────────── */

async function main() {
  // Verificar se já existe seed (idempotência)
  const existingUnits = await prisma.unit.findMany({ where: { code: { in: UNITS.map((u) => u.code) } } });
  if (existingUnits.length === UNITS.length) {
    console.log("Seed já foi executado. Nenhuma ação necessária.");
    return;
  }

  // Limpar dados anteriores para re-seed parcial
  await prisma.employeeMonthlyRecord.deleteMany();
  await prisma.unitMonthlyMetric.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.user.deleteMany();

  console.log("Criando dados de demonstração...");

  // ── Admin ──
  await prisma.user.create({
    data: {
      name: "Administrador POSTO BRASIL",
      email: "admin@postobrasil.local",
      passwordHash: "$2b$10$replace.with.real.hash.in.auth.phase",
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  // ── Unidades ──
  const unitMap: Record<string, string> = {};
  for (const u of UNITS) {
    const unit = await prisma.unit.create({
      data: { name: u.name, code: u.code, isActive: true },
    });
    unitMap[u.code] = unit.id;
  }
  console.log(`  ✓ ${UNITS.length} unidades criadas`);

  // ── Funcionários ──
  const employeeMap: Record<string, { id: string; unitCode: UnitCode; index: number }[]> = {};
  let totalEmployees = 0;

  for (const code of Object.keys(EMPLOYEES) as UnitCode[]) {
    employeeMap[code] = [];
    for (let i = 0; i < EMPLOYEES[code].length; i++) {
      const emp = EMPLOYEES[code][i];
      const created = await prisma.employee.create({
        data: {
          unitId: unitMap[code],
          name: emp.name,
          email: emp.email,
          document: emp.document,
          status: EmployeeStatus.ACTIVE,
          shift: EmployeeShift.DAYTIME,
          employmentType: EmploymentType.PERMANENT,
          admissionDate: new Date("2024-03-01"),
          eligibleForCommission: true,
        },
      });
      employeeMap[code].push({ id: created.id, unitCode: code, index: i });
      totalEmployees++;
    }
  }
  console.log(`  ✓ ${totalEmployees} funcionários criados`);

  // ── Helper: gerar dados de um mês para todas as unidades ──
  async function seedMonth(
    year: number,
    month: number,
    scale: number,
    notes: string,
    isClosed: boolean,
  ) {
    for (const code of Object.keys(CURRENT_MONTH) as UnitCode[]) {
      const base = CURRENT_MONTH[code];
      const goalAmount = round2(base.goalAmount * scale);
      const resultAmount = round2(base.resultAmount * scale);
      const goalLiters = round2(base.goalLiters * scale);
      const totalLiters = round2(base.totalLiters * scale);

      const unitMetGoal = totalLiters >= goalLiters;
      const closedAt = isClosed
        ? new Date(Date.UTC(year, month - 1, month === 2 ? 28 : [4, 6, 9, 11].includes(month) ? 30 : 31, 23, 59, 59))
        : null;

      await prisma.unitMonthlyMetric.create({
        data: {
          unitId: unitMap[code],
          year,
          month,
          goalAmount: goalAmount.toFixed(2),
          resultAmount: resultAmount.toFixed(2),
          goalLiters: goalLiters.toFixed(2),
          notes,
          closedAt,
        },
      });

      // Registros mensais de cada funcionário
      const employees = employeeMap[code];
      const weights = EMPLOYEE_LITER_WEIGHTS[code];
      const empGoalLiters = goalLiters / employees.length;

      // Verificar se todos bateram meta individual
      const employeeData = employees.map((emp, idx) => {
        const soldLiters = round2(totalLiters * weights[idx]);
        const individualGoal = round2(empGoalLiters);
        const metGoal = soldLiters >= individualGoal;
        return { emp, soldLiters, individualGoal, metGoal };
      });

      const allMetGoal = employeeData.every((e) => e.metGoal);
      const bonusUnlocked = unitMetGoal && allMetGoal;

      for (const { emp, soldLiters, individualGoal } of employeeData) {
        const baseRate = RATE_PERMANENT;
        const baseCommission = round2(soldLiters * baseRate);
        const bonusApplied = bonusUnlocked;
        const bonusAmount = bonusApplied ? round2(baseCommission * BONUS_MULTIPLIER) : 0;
        const totalCommission = round2(baseCommission + bonusAmount);

        await prisma.employeeMonthlyRecord.create({
          data: {
            employeeId: emp.id,
            unitId: unitMap[code],
            year,
            month,
            employmentType: EmploymentType.PERMANENT,
            employeeShift: EmployeeShift.DAYTIME,
            baseGoalLiters: individualGoal.toFixed(3),
            finalGoalLiters: individualGoal.toFixed(3),
            goalSource: GoalSource.MANUAL,
            soldLiters: soldLiters.toFixed(3),
            ...(isClosed
              ? {
                  baseRate: baseRate.toFixed(4),
                  baseCommission: baseCommission.toFixed(2),
                  bonusApplied,
                  bonusAmount: bonusAmount.toFixed(2),
                  totalCommission: totalCommission.toFixed(2),
                }
              : {}),
          },
        });
      }
    }
  }

  // ── Meses históricos (fechados) ──
  for (const h of HISTORY_MONTHS) {
    await seedMonth(h.year, h.month, h.scale, h.notes, true);
  }
  console.log(`  ✓ ${HISTORY_MONTHS.length} meses históricos gerados (fechados)`);

  // ── Mês atual (aberto) ──
  await seedMonth(CURRENT_PERIOD.year, CURRENT_PERIOD.month, 1.0, "Mês em andamento", false);
  console.log(`  ✓ Mês atual (${CURRENT_PERIOD.month}/${CURRENT_PERIOD.year}) gerado (aberto)`);

  // ── Resumo ──
  const totalMetrics = await prisma.unitMonthlyMetric.count();
  const totalRecords = await prisma.employeeMonthlyRecord.count();
  console.log(`\nSeed concluído com sucesso!`);
  console.log(`  Unidades: ${UNITS.length}`);
  console.log(`  Funcionários: ${totalEmployees}`);
  console.log(`  Métricas mensais: ${totalMetrics}`);
  console.log(`  Registros de comissão: ${totalRecords}`);
}

main()
  .catch((error) => {
    console.error("Erro ao executar seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
