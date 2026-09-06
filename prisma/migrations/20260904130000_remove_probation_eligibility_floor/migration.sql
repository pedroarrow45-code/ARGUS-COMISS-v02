-- O fator de experiência reduz a meta aplicável; a elegibilidade volta a
-- representar o atingimento integral (100%) dessa meta já reduzida.
ALTER TABLE "commission_rule_sets"
  ALTER COLUMN "minimumEligibilityPercentage" SET DEFAULT 100.00;

ALTER TABLE "employee_monthly_records"
  ADD COLUMN IF NOT EXISTS "baseStockGoal" DECIMAL(14,2);

ALTER TABLE "employee_monthly_records"
  ADD COLUMN IF NOT EXISTS "effectiveStockGoal" DECIMAL(14,2);

UPDATE "employee_monthly_records"
SET "baseStockGoal" = "stockGoalCommission"
WHERE "baseStockGoal" IS NULL;
