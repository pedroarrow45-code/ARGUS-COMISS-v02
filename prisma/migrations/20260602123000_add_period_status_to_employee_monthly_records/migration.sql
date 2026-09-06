CREATE TYPE "EmployeePeriodStatus" AS ENUM ('ACTIVE', 'VACATION', 'ABSENCE', 'MEDICAL_LEAVE');

ALTER TABLE "employee_monthly_records"
  ADD COLUMN "periodStatus" "EmployeePeriodStatus" NOT NULL DEFAULT 'ACTIVE';
