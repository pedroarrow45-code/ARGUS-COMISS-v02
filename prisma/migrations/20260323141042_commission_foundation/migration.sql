-- CreateEnum
CREATE TYPE "EmployeeShift" AS ENUM ('DAYTIME', 'NIGHTTIME');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'PROBATION');

-- CreateEnum
CREATE TYPE "GoalSource" AS ENUM ('AUTOMATIC', 'MANUAL');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "employmentType" "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
ADD COLUMN     "shift" "EmployeeShift" NOT NULL DEFAULT 'DAYTIME';

-- AlterTable
ALTER TABLE "unit_monthly_metrics" ADD COLUMN     "goalLiters" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "employee_monthly_records" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "employeeShift" "EmployeeShift" NOT NULL,
    "baseGoalLiters" DECIMAL(14,2) NOT NULL,
    "finalGoalLiters" DECIMAL(14,2) NOT NULL,
    "goalSource" "GoalSource" NOT NULL DEFAULT 'AUTOMATIC',
    "soldLiters" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "baseRate" DECIMAL(10,4),
    "baseCommission" DECIMAL(14,2),
    "bonusApplied" BOOLEAN NOT NULL DEFAULT false,
    "bonusAmount" DECIMAL(14,2),
    "totalCommission" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_monthly_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_monthly_records_employeeId_idx" ON "employee_monthly_records"("employeeId");

-- CreateIndex
CREATE INDEX "employee_monthly_records_unitId_year_month_idx" ON "employee_monthly_records"("unitId", "year", "month");

-- CreateIndex
CREATE INDEX "employee_monthly_records_year_month_idx" ON "employee_monthly_records"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "employee_monthly_records_employeeId_year_month_key" ON "employee_monthly_records"("employeeId", "year", "month");

-- AddForeignKey
ALTER TABLE "employee_monthly_records" ADD CONSTRAINT "employee_monthly_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_monthly_records" ADD CONSTRAINT "employee_monthly_records_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
