# Recuperação da migration `20260904130000_remove_probation_eligibility_floor`

Esta migration pode falhar no `UPDATE commission_rule_sets` da versão original:
o trigger `commission_rule_sets_financial_immutability` impede a alteração de
campos financeiros de regras que já foram usadas em fechamentos. A migration
corrigida não atualiza essas linhas e não altera resultados históricos.

## 1. Inspecionar o Neon antes de resolver

Execute no SQL Editor do Neon, no mesmo banco/branch usado pela Vercel:

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at, logs
FROM "_prisma_migrations"
WHERE migration_name = '20260904130000_remove_probation_eligibility_floor';

SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'employee_monthly_records'
  AND column_name IN ('baseStockGoal', 'effectiveStockGoal')
ORDER BY column_name;

SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'commission_rule_sets'
  AND column_name = 'minimumEligibilityPercentage';

SELECT "minimumEligibilityPercentage", count(*)
FROM "commission_rule_sets"
GROUP BY "minimumEligibilityPercentage"
ORDER BY "minimumEligibilityPercentage";
```

Não use `migrate reset`, `db push --force-reset`, `DROP` ou `TRUNCATE`.

## 2A. Nenhuma alteração foi aplicada

Se a migration está `FAILED` e as duas colunas não existem, marque somente a
tentativa como revertida e reaplique o SQL corrigido:

```bash
DIRECT_URL="$NEON_DIRECT_URL" npx prisma migrate resolve --rolled-back 20260904130000_remove_probation_eligibility_floor
DIRECT_URL="$NEON_DIRECT_URL" npx prisma migrate deploy
DIRECT_URL="$NEON_DIRECT_URL" npx prisma migrate status
npx prisma generate
npm run build
```

## 2B. Houve execução parcial

Se o default já é `100` e/ou uma das colunas já existe, **não marque a migration
como aplicada**: o backfill pode ainda não ter ocorrido. A migration corrigida é
reexecutável (`ADD COLUMN IF NOT EXISTS` e backfill apenas onde o destino é
`NULL`). Marque a tentativa como revertida e rode o mesmo fluxo:

```bash
DIRECT_URL="$NEON_DIRECT_URL" npx prisma migrate resolve --rolled-back 20260904130000_remove_probation_eligibility_floor
DIRECT_URL="$NEON_DIRECT_URL" npx prisma migrate deploy
DIRECT_URL="$NEON_DIRECT_URL" npx prisma migrate status
npx prisma generate
npm run build
```

O `--rolled-back` altera apenas o registro de controle da tentativa com falha;
ele não desfaz DDL nem apaga dados. Não o use se a migration já estiver marcada
como concluída (`finished_at` preenchido sem falha), nem contra outro banco ou
branch Neon.

## Exceção: completar manualmente e marcar como aplicada

Use `--applied` somente se um operador tiver conferido e executado manualmente,
no banco correto, **todos** os statements da versão corrigida: default `100`, as
duas colunas existentes com `DECIMAL(14,2)` e o backfill de `baseStockGoal`.
Depois da conferência:

```bash
DIRECT_URL="$NEON_DIRECT_URL" npx prisma migrate resolve --applied 20260904130000_remove_probation_eligibility_floor
DIRECT_URL="$NEON_DIRECT_URL" npx prisma migrate status
```

Não use `--applied` apenas porque uma ou duas alterações já aparecem no schema.
Após `migrate status` indicar que não há migrations pendentes ou com falha,
execute `prisma generate`, o build e então faça o redeploy na Vercel.

## Validação final de dados e schema

Depois do deploy, repita as consultas de `information_schema` e execute:

```sql
SELECT migration_name, finished_at, rolled_back_at, logs
FROM "_prisma_migrations"
WHERE migration_name = '20260904130000_remove_probation_eligibility_floor'
ORDER BY started_at DESC;

SELECT count(*) AS metas_de_estoque_sem_base
FROM "employee_monthly_records"
WHERE "stockGoalCommission" IS NOT NULL
  AND "baseStockGoal" IS DISTINCT FROM "stockGoalCommission";
```

O registro mais recente deve ter `finished_at` preenchido e nenhum erro; as duas
colunas devem ser `numeric(14,2)`, o default deve ser `100.00` e
`metas_de_estoque_sem_base` deve retornar zero. `effectiveStockGoal` pode ficar
`NULL` em registros históricos: ele é um snapshot preenchido por novos
fechamentos, e não deve ser retrocalculado silenciosamente.
