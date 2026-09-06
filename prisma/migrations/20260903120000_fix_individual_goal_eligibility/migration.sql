-- Novas versões sempre registram o requisito integral. As versões e os
-- fechamentos históricos existentes permanecem inalterados para auditoria.
ALTER TABLE "commission_rule_sets"
  ALTER COLUMN "minimumEligibilityPercentage" SET DEFAULT 100.00;
