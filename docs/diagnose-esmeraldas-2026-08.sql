-- Diagnóstico somente leitura. Execute no mesmo branch Neon usado pela Vercel.
WITH target_unit AS (
  SELECT id, name FROM units
  WHERE name = 'POSTO BRASIL - ESMERALDAS'
), records AS (
  SELECT r.*, to_jsonb(r) AS raw_record
  FROM employee_monthly_records r
  JOIN target_unit u ON u.id = r."unitId"
  WHERE r.year = 2026 AND r.month = 8
)
SELECT
  e.name AS "FUNCIONÁRIO",
  r."employeeId",
  r."unitId",
  r."employmentType",
  r."employeeShift",
  r."baseGoalLiters" AS "BASE GOAL",
  r."finalGoalLiters" AS "FINAL/EFFECTIVE GOAL",
  r."soldLiters" AS "SOLD",
  COALESCE((r.raw_record ->> 'baseStockGoal')::numeric, r."stockGoalCommission") AS "BASE STOCK GOAL",
  (r.raw_record ->> 'effectiveStockGoal')::numeric AS "EFFECTIVE STOCK GOAL",
  r."soldStock",
  r."stockCommission",
  r."baseRate",
  r."baseCommission",
  r."litersMultiplier",
  r."stockMultiplier",
  r."totalCommission",
  r."finalTotalCommission" AS "FINAL TOTAL",
  r."commissionEligible",
  r."minimumEligibilityPercentage",
  r."goalSource",
  r."periodStatus",
  e.status AS "STATUS ATUAL",
  e."unitId" AS "UNIDADE ATUAL",
  CASE WHEN e.status <> 'ACTIVE' OR e."unitId" <> r."unitId" THEN 'OCULTO PELO FILTRO ANTIGO' ELSE 'VISÍVEL' END AS "DIVERGÊNCIA"
FROM records r
JOIN employees e ON e.id = r."employeeId"
ORDER BY e.name;

SELECT
  u.name,
  m."goalLiters", m."goalStock", m."closedAt", m."commissionRuleSetId"
FROM unit_monthly_metrics m
JOIN units u ON u.id = m."unitId"
WHERE u.name = 'POSTO BRASIL - ESMERALDAS'
  AND m.year = 2026 AND m.month = 8;
