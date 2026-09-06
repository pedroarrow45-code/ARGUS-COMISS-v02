# Auditoria pré-PR e pré-redeploy (Vercel)

Data da auditoria: **2026-04-03**

## Escopo
Auditoria de persistência, risco de perda de dados, migrations, seeds/resets, compatibilidade de schema, API de escrita e variáveis de ambiente para o projeto `mvpcomiss`.

---

## ETAPA 1 — Onde os dados estão armazenados

### 1) Banco relacional principal
- **Prisma + PostgreSQL**:
  - `prisma/schema.prisma` define `datasource db` com `provider = "postgresql"` e `url = env("DATABASE_URL")`.
  - Persistência principal do módulo de comissões em tabelas:
    - `users`
    - `units`
    - `employees`
    - `unit_monthly_metrics`
    - `employee_monthly_records`

### 2) Persistência no browser (cliente)
- **LocalStorage (Zustand persist)** em projetos:
  - `src/store/project-store.ts` usa `persist` + `createJSONStorage(() => localStorage)` com chave `argus-group-projects`.
- O módulo `fuel-operations` usa store em memória com seed local (`src/features/fuel-operations/seed.ts`), sem persistência em banco.

### 3) Dados mock/fallback
- `src/data/mock-projects.ts`, `src/data/mock-news.ts` e `src/features/fuel-operations/seed.ts` fornecem dados de fallback/seed para UI.
- `src/app/api/news/route.ts` integra API externa (NewsAPI) e cai para fallback local caso falhe.

### 4) Não encontrado no código
- **Supabase / Firebase / MongoDB**: não encontrados.
- **Arquivos JSON como datastore persistente**: não encontrados (apenas TS mock).

---

## ETAPA 2 — Variáveis de ambiente

Arquivos localizados:
- `.env.example`: apenas `NEWS_API_KEY`.
- `.env` local: `DATABASE_URL` (valor redigido nesta auditoria).
- Não há `.env.local` nem `.env.production` versionados no repositório.

### Variáveis solicitadas
- `DATABASE_URL`: **encontrada** (.env local).
- `NEXT_PUBLIC_*`: **não encontrada** em arquivos versionados.
- `SUPABASE_URL` / `SUPABASE_KEY`: **não encontradas**.
- `API_URL`: **não encontrada**.
- Extra relevante: `NEWS_API_KEY` usada em `/api/news`.

### Risco Preview x Production
- **Não é possível provar pelo repositório** se Preview e Production usam bancos diferentes: isso depende de configuração no painel da Vercel.
- Há **risco real** de apontar ambiente para banco errado se `DATABASE_URL` for igual entre Preview/Production ou se for trocado manualmente sem segregação.

---

## ETAPA 3 — Migrations

Migrations localizadas em `prisma/migrations`:
1. `20260320152305_init_mvp_schema`
2. `20260323141042_commission_foundation`
3. `20260324153000_employee_liters_scale_3`

### Busca por operações destrutivas
- Não foram encontrados `DROP TABLE`, `DROP COLUMN`, `RENAME COLUMN`, `DELETE` massivo dentro de migration SQL.
- Há `ALTER TABLE ... ALTER COLUMN ... TYPE DECIMAL(14,3)` na migration `employee_liters_scale_3`.

### Riscos identificados
- **Risco baixo a médio** no `ALTER TYPE` de escala decimal (2 -> 3 casas):
  - Tendência é compatível (aumenta precisão), mas deve ser validado em banco real (locks, tempo de alteração em tabela grande).
- **Risco de drift histórico**:
  - Há histórico de correção em commit removendo coluna `deletedAt` não aplicada em produção.
  - Recomenda-se checar `prisma migrate status` em Production e Preview antes do deploy para garantir alinhamento.

---

## ETAPA 4 — Seeds, resets e scripts potencialmente destrutivos

Arquivo crítico:
- `prisma/seed.ts`

### Comportamento
- Se não detectar todas as unidades esperadas, executa limpeza com:
  - `employeeMonthlyRecord.deleteMany()`
  - `unitMonthlyMetric.deleteMany()`
  - `employee.deleteMany()`
  - `unit.deleteMany()`
  - `user.deleteMany()`
- Em seguida recria dados de demonstração.

### Se roda automaticamente?
- `package.json` define `"prisma": { "seed": "tsx prisma/seed.ts" }`.
- **Não há script de deploy/build chamando seed** automaticamente.
- Script `build` roda `prisma generate && next build` (sem `prisma migrate deploy` e sem `seed`).

### Risco
- **ALTO** se alguém executar seed no banco de Production/Preview por engano (apaga dados de negócio).

---

## ETAPA 5 — Mudanças no schema e compatibilidade

### Estrutura atual (resumo)
- Entidades centrais: `User`, `Unit`, `Employee`, `UnitMonthlyMetric`, `EmployeeMonthlyRecord`.
- Novos campos/estruturas ao longo das migrations:
  - `employees.shift`, `employees.employmentType`
  - `unit_monthly_metrics.goalLiters`
  - nova tabela `employee_monthly_records`
  - `baseGoalLiters/finalGoalLiters/soldLiters` com `DECIMAL(14,3)`

### Incompatibilidades potenciais
- Não há evidência de remoção/rename de coluna em migrations atuais.
- Regras de fechamento mensal impedem edição após `closedAt`, o que evita inconsistência por sobrescrita tardia.
- Se houver bancos antigos sem migrations aplicadas, funcionalidades que dependem de `employee_monthly_records` e `goalLiters` podem quebrar.

---

## ETAPA 6 — API, Server Actions e escrita em persistência

### Endpoints/API
- `src/app/api/news/route.ts` só lê API externa e retorna fallback; **não grava no banco**.

### Server actions com escrita no banco
- `src/features/commission-dashboard/actions/*.ts`:
  - criação/edição/soft-delete de unidade
  - CRUD de funcionário
  - upsert de metas e registros mensais
  - fechamento/reabertura de mês
  - cálculo e persistência de comissão

### Proteções encontradas
- Validação de período (ano/mês), IDs obrigatórios e valores não-negativos.
- Bloqueio de edição em período fechado (`closedAt`).
- Transações em operações críticas de fechamento/cálculo.
- Soft delete de unidade via `isActive = false` (evita quebra por FK em hard delete).

### Pontos de atenção
- `batchUpsertEmployeeMonthlyRecords` chama upsert item a item (sem transação única): risco de sucesso parcial em falhas intermediárias.

---

## ETAPA 7 — Relatório final

## Onde os dados estão
1. **Principal**: PostgreSQL via Prisma (`DATABASE_URL`).
2. **Cliente**: LocalStorage (projetos em Zustand persist).
3. **Mock/fallback**: arquivos TS locais (news/projetos/fuel operations).
4. **Externo**: NewsAPI (somente leitura para notícias).

## Riscos identificados

### Risco alto
1. **Seed destrutivo (`prisma/seed.ts`)**:
   - Pode apagar dados reais (`deleteMany`) se rodar fora de ambiente controlado.

### Risco médio
2. **Configuração de ambientes na Vercel**:
   - Sem evidência no repo de separação Preview vs Production.
   - Possível apontamento cruzado para o mesmo banco.
3. **Drift de migration histórico**:
   - Já houve migração não aplicada (caso `deletedAt`), indicando necessidade de validação explícita de status antes do deploy.
4. **Batch upsert sem transação única**:
   - Pode gerar estado parcial em erro durante processamento de lote.

### Risco baixo
5. **ALTER TYPE decimal para 3 casas**:
   - Geralmente seguro, mas exige validação operacional em banco com volume real.

## Probabilidade de perda de dados
- **Alta**, se `prisma db seed` for executado no banco errado.
- **Baixa a média**, no fluxo normal de deploy, desde que seed não seja executado e migrations estejam alinhadas.

## Segurança do deploy (PR + redeploy)

### Status: **NÃO liberar imediatamente sem guardrails**
Há pelo menos 1 risco alto (seed destrutivo). Antes do PR/redeploy, implementar controles operacionais mínimos.

## Recomendações antes do deploy
1. **Bloquear seed em produção**:
   - Adicionar guarda explícita no `prisma/seed.ts` (ex.: abortar quando `NODE_ENV=production` ou quando URL não contiver marcador de ambiente dev).
2. **Separar DATABASE_URL por ambiente na Vercel**:
   - Confirmar valores distintos para `Preview` e `Production` no painel.
3. **Rodar pré-check de migration**:
   - `npx prisma migrate status`
   - `npx prisma migrate deploy --preview-feature` (ou fluxo oficial equivalente da versão adotada).
4. **Backup/snapshot antes de migration em production**.
5. **Tornar batch upsert transacional** para evitar atualização parcial.
6. **Definir runbook de deploy** com passos explícitos de validação e rollback.

## Checklist final (go/no-go)
- [ ] Confirmado que Preview e Production usam bancos diferentes.
- [ ] Backup do banco de Production criado e testado.
- [ ] `prisma migrate status` limpo em Preview e Production.
- [ ] Seed bloqueado para Production.
- [ ] Equipe alinhada para **não** executar `prisma db seed` em ambientes com dados reais.
- [ ] Smoke test pós-deploy validando leitura/escrita de métricas e fechamento mensal.

## Decisão
**PAUSAR PR + redeploy até mitigar o risco alto do seed destrutivo e validar separação de banco por ambiente.**
