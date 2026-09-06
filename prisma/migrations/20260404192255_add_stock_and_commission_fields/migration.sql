-- AlterTable
ALTER TABLE "employee_monthly_records" ADD COLUMN     "finalTotalCommission" DECIMAL(14,2),
ADD COLUMN     "litersMultiplier" DECIMAL(4,2),
ADD COLUMN     "soldStock" DECIMAL(14,2),
ADD COLUMN     "stockCommission" DECIMAL(14,2),
ADD COLUMN     "stockMultiplier" DECIMAL(4,2);

-- AlterTable
ALTER TABLE "unit_monthly_metrics" ADD COLUMN     "goalStock" DECIMAL(14,2);
