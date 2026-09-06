-- O percentual é o piso de elegibilidade exclusivo de funcionários em
-- experiência. A meta final e os fechamentos históricos não são alterados.
ALTER TABLE "commission_rule_sets"
  ALTER COLUMN "minimumEligibilityPercentage" SET DEFAULT 70.00;

UPDATE "commission_rule_sets"
SET "minimumEligibilityPercentage" = 70.00;
