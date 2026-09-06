CREATE TYPE "CommissionRuleSetStatus" AS ENUM ('ACTIVE', 'RETIRED');

CREATE TABLE "commission_rule_sets" (
  "id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "CommissionRuleSetStatus" NOT NULL DEFAULT 'ACTIVE',
  "validFrom" DATE NOT NULL,
  "validUntil" DATE,
  "daytimePermanentRate" DECIMAL(10,4) NOT NULL,
  "nighttimePermanentRate" DECIMAL(10,4) NOT NULL,
  "daytimeProbationRate" DECIMAL(10,4) NOT NULL,
  "nighttimeProbationRate" DECIMAL(10,4) NOT NULL,
  "probationGoalFactor" DECIMAL(6,4) NOT NULL,
  "neutralMultiplier" DECIMAL(6,4) NOT NULL,
  "greenMinimumPercentage" DECIMAL(7,2) NOT NULL,
  "greenMultiplier" DECIMAL(6,4) NOT NULL,
  "blueMinimumPercentage" DECIMAL(7,2) NOT NULL,
  "blueMultiplier" DECIMAL(6,4) NOT NULL,
  "teamBonusRate" DECIMAL(6,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commission_rule_sets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commission_rule_sets_validity_check" CHECK ("validUntil" IS NULL OR "validUntil" >= "validFrom")
);

CREATE UNIQUE INDEX "commission_rule_sets_version_key" ON "commission_rule_sets"("version");
CREATE INDEX "commission_rule_sets_status_validFrom_validUntil_idx" ON "commission_rule_sets"("status", "validFrom", "validUntil");

INSERT INTO "commission_rule_sets" (
  "id", "version", "status", "validFrom", "daytimePermanentRate", "nighttimePermanentRate",
  "daytimeProbationRate", "nighttimeProbationRate", "probationGoalFactor", "neutralMultiplier",
  "greenMinimumPercentage", "greenMultiplier", "blueMinimumPercentage", "blueMultiplier", "teamBonusRate"
) VALUES (
  '00000000-0000-4000-8000-000000000001', 1, 'ACTIVE', DATE '2000-01-01',
  0.0100, 0.0300, 0.0075, 0.0200, 0.7000, 1.0000, 105.00, 1.1500, 135.00, 1.2500, 0.0500
);

ALTER TABLE "unit_monthly_metrics" ADD COLUMN "commissionRuleSetId" UUID;
UPDATE "unit_monthly_metrics"
SET "commissionRuleSetId" = '00000000-0000-4000-8000-000000000001'
WHERE "closedAt" IS NOT NULL;
CREATE INDEX "unit_monthly_metrics_commissionRuleSetId_idx" ON "unit_monthly_metrics"("commissionRuleSetId");
ALTER TABLE "unit_monthly_metrics" ADD CONSTRAINT "unit_monthly_metrics_commissionRuleSetId_fkey"
  FOREIGN KEY ("commissionRuleSetId") REFERENCES "commission_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_monthly_metrics" ADD CONSTRAINT "closed_metric_requires_commission_rule_set"
  CHECK ("closedAt" IS NULL OR "commissionRuleSetId" IS NOT NULL);

CREATE FUNCTION prevent_used_commission_rule_financial_update() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "unit_monthly_metrics" WHERE "commissionRuleSetId" = OLD."id") AND
     ROW(NEW."version", NEW."validFrom", NEW."daytimePermanentRate", NEW."nighttimePermanentRate", NEW."daytimeProbationRate", NEW."nighttimeProbationRate",
         NEW."probationGoalFactor", NEW."neutralMultiplier", NEW."greenMinimumPercentage", NEW."greenMultiplier",
         NEW."blueMinimumPercentage", NEW."blueMultiplier", NEW."teamBonusRate") IS DISTINCT FROM
     ROW(OLD."version", OLD."validFrom", OLD."daytimePermanentRate", OLD."nighttimePermanentRate", OLD."daytimeProbationRate", OLD."nighttimeProbationRate",
         OLD."probationGoalFactor", OLD."neutralMultiplier", OLD."greenMinimumPercentage", OLD."greenMultiplier",
         OLD."blueMinimumPercentage", OLD."blueMultiplier", OLD."teamBonusRate") THEN
    RAISE EXCEPTION 'Used commission rule sets are financially immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "commission_rule_sets_financial_immutability"
BEFORE UPDATE ON "commission_rule_sets" FOR EACH ROW EXECUTE FUNCTION prevent_used_commission_rule_financial_update();
