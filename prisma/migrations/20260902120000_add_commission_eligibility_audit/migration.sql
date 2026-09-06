-- Additive-only migration: operational inputs and existing closing results are untouched.
ALTER TABLE "commission_rule_sets"
  ADD COLUMN "minimumEligibilityPercentage" DECIMAL(7,2) NOT NULL DEFAULT 70.00;

ALTER TABLE "employee_monthly_records"
  ADD COLUMN "commissionEligible" BOOLEAN,
  ADD COLUMN "minimumEligibilityPercentage" DECIMAL(7,2),
  ADD COLUMN "ineligibilityReason" VARCHAR(255);

CREATE TABLE "commission_recalculation_audits" (
  "id" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "commissionRuleSetId" UUID NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "actor" VARCHAR(160) NOT NULL,
  "previousResults" JSONB NOT NULL,
  "newResults" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commission_recalculation_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commission_recalculation_audits_unit_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commission_recalculation_audits_rule_fkey" FOREIGN KEY ("commissionRuleSetId") REFERENCES "commission_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "commission_recalculation_audits_unitId_year_month_idx" ON "commission_recalculation_audits"("unitId", "year", "month");
CREATE INDEX "commission_recalculation_audits_rule_idx" ON "commission_recalculation_audits"("commissionRuleSetId");

-- Include the new financial field in the immutability guard for rule sets already used by a closing.
CREATE OR REPLACE FUNCTION prevent_used_commission_rule_financial_update() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "unit_monthly_metrics" WHERE "commissionRuleSetId" = OLD."id") AND
     ROW(NEW."version", NEW."validFrom", NEW."daytimePermanentRate", NEW."nighttimePermanentRate", NEW."daytimeProbationRate", NEW."nighttimeProbationRate",
         NEW."probationGoalFactor", NEW."minimumEligibilityPercentage", NEW."neutralMultiplier", NEW."greenMinimumPercentage", NEW."greenMultiplier",
         NEW."blueMinimumPercentage", NEW."blueMultiplier", NEW."teamBonusRate") IS DISTINCT FROM
     ROW(OLD."version", OLD."validFrom", OLD."daytimePermanentRate", OLD."nighttimePermanentRate", OLD."daytimeProbationRate", OLD."nighttimeProbationRate",
         OLD."probationGoalFactor", OLD."minimumEligibilityPercentage", OLD."neutralMultiplier", OLD."greenMinimumPercentage", OLD."greenMultiplier",
         OLD."blueMinimumPercentage", OLD."blueMultiplier", OLD."teamBonusRate") THEN
    RAISE EXCEPTION 'Used commission rule sets are financially immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
