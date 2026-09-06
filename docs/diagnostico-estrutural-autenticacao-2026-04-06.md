# Diagnóstico estrutural para autenticação (pré-implementação)

Data: 2026-04-06

> Objetivo: mapear a estrutura real do projeto e definir a forma mínima e sem conflitos para autenticação por cookie + middleware, sem alterar Prisma, sem refatoração ampla e sem dependências pesadas.

## 1) Estrutura atual do projeto

### 1.1 Router e organização

- O projeto usa **Next.js App Router** com base em `src/app`.
- Há `layout.tsx` raiz em `src/app/layout.tsx`.
- Rotas de API em `src/app/api/**/route.ts`.

### 1.2 Rotas/páginas atualmente existentes

- Página principal: `/` (`src/app/page.tsx`).
- Login visual: `/login` (`src/app/login/page.tsx`).
- Páginas adicionais: `/projetos`, `/insights`, `/noticias`, `/operacoes-combustivel`.
- Endpoints de auth já presentes:
  - `POST/GET /api/auth/login`
  - `POST /api/auth/logout`
- Endpoint de notícias: `/api/news`.

### 1.3 Layouts e composição de UI

- `src/app/layout.tsx`: layout raiz (fonts + `globals.css`).
- `src/app/operacoes-combustivel/layout.tsx`: layout específico de fonte para o módulo de operações.
- Home (`/`) renderiza `CommissionDashboardApp`, que controla navegação interna por **tabs locais em estado React** (não por rotas):
  - `CommissionSidebar` (menu lateral do dashboard)
  - `CommissionTopbar` (topbar com botão de saída)
- Existe também `src/components/layout/header.tsx` e `src/components/layout/sidebar.tsx` no repositório, mas sem uso atual no app principal.

### 1.4 Navegação atual

- A navegação principal da Home não troca URL para tabs internas (dashboard, unidades, funcionários etc.); ela usa estado local no cliente.
- As páginas `/projetos`, `/insights`, `/noticias` são rotas independentes em `src/app`, mas não estão no menu atual do dashboard de comissão.

### 1.5 Pontos ideais de login/logout

- **Login visual**: manter em `/login` (página dedicada).
- **Login de credenciais**: `POST /api/auth/login`.
- **Logout**:
  - ideal manter como `POST /api/auth/logout`.
  - ponto de acionamento ideal atual: botão “Sair” na `CommissionTopbar` (já existe).

## 2) Middleware: posição correta neste projeto

- Em App Router, o middleware deve ficar no **root do projeto** (já está em `middleware.ts`).
- A configuração atual de matcher cobre praticamente todo o app e exclui `_next/static`, `_next/image` e `favicon.ico`.
- A whitelist de caminhos públicos já inclui `/login`, `/api/auth/login`, `/api/auth/logout`.

## 3) Conflitos/riscos potenciais antes de implementar qualquer ajuste

### 3.1 Conflitos de rota

- Risco clássico: criar `src/app/login/route.ts` junto de `src/app/login/page.tsx` sem necessidade. Isso confunde responsabilidades de rota visual vs endpoint.
- Risco clássico: duplicar logout em mais de um endpoint (`/api/logout` + `/api/auth/logout`).

### 3.2 Conflitos com App Router

- Misturar navegação de página com endpoint API (ex.: tentar “navegar” para `/api/auth/login`) causa fluxos estranhos.
- Em App Router, a tela deve navegar para páginas (`/login`, `/`) e submeter formulário para endpoint somente para mutação de estado (cookie).

### 3.3 Conflitos com middleware

- Se o matcher não excluir assets e rotas públicas mínimas, pode gerar loop de redirect.
- Se `/login` não for público, usuários sem cookie entram em ciclo de redirecionamento.

### 3.4 Riscos de cookie/sessão

- Necessidade de variáveis de ambiente em produção:
  - `AUTH_EMAIL`
  - `AUTH_PASSWORD`
  - `AUTH_SESSION_SECRET`
- Se `AUTH_SESSION_SECRET` mudar em deploy, todas as sessões vigentes invalidam (comportamento esperado, mas deve ser consciente).
- Diferença de protocolo em local/prod para cookie `secure` pode gerar inconsistência se ambiente for configurado errado.

### 3.5 Riscos de deploy (Vercel)

- Falta de env vars quebra login (erro em runtime ao validar credenciais/token).
- Middleware rodando no edge exige código compatível (atual usa Web Crypto, que é compatível).
- Cache inesperado em rotas autenticadas pode gerar confusão se não houver política clara de dinamicidade; a Home já usa `connection()` para reforçar comportamento dinâmico.

## 4) Arquitetura mínima recomendada (sem refatoração ampla)

### 4.1 Arquivos que devem existir

- **Página visual de login**: `src/app/login/page.tsx`
- **Endpoint de login**: `src/app/api/auth/login/route.ts`
- **Endpoint de logout**: `src/app/api/auth/logout/route.ts`
- **Middleware**: `middleware.ts` (na raiz)
- **Utilitários de sessão/auth**: `src/lib/auth.ts`

### 4.2 Regra de responsabilidade por camada

- `page.tsx` de login: apenas UI + formulário + feedback.
- `route.ts` de login/logout: mutação de cookie e redirects pós-ação.
- `lib/auth.ts`: assinatura/validação de token e leitura de config.
- `middleware.ts`: gatekeeper de acesso às rotas protegidas.

## 5) Arquivos/padrões que NÃO devem existir

- Não criar `page.tsx` e `route.ts` no mesmo segmento **`/login`** para finalidades concorrentes.
- Não duplicar endpoint de logout em caminhos diferentes.
- Não fazer navegação de usuário para rota de API como se fosse página de interface.
- Não criar provider de auth complexo (OAuth/SSO/banco de usuários) para este escopo.

## 6) Fluxo correto (alvo)

1. Usuário acessa `/`.
2. Middleware verifica cookie de sessão.
3. Sem sessão válida: redirect para `/login`.
4. `/login` renderiza formulário.
5. Form envia `POST` para `/api/auth/login`.
6. Login válido cria cookie HTTP-only e redireciona para `/`.
7. Logout envia `POST` para `/api/auth/logout`, limpa cookie e redireciona para `/login`.

## 7) Plano de implementação cirúrgico (ordem exata)

> Observação: a base atual já contém praticamente essa arquitetura. Portanto, o plano abaixo é de validação e hardening mínimo, sem introduzir nova estrutura.

### Etapa 1 — Inventário e congelamento

- Confirmar que não há rotas duplicadas de auth.
- Confirmar que login visual está apenas em `/login`.
- Confirmar que logout é unificado em `/api/auth/logout`.

### Etapa 2 — Validação de ambiente

- Validar envs de auth em `.env`/Vercel Project Settings.
- Definir credenciais finais:
  - `AUTH_EMAIL=admin@autopostobrasil.com`
  - `AUTH_PASSWORD=AutoPostoBrasil@2026`
- Garantir `AUTH_SESSION_SECRET` forte (>= 32 chars aleatórios).

### Etapa 3 — Validação do middleware

- Revisar matcher para evitar loops.
- Revisar lista de rotas públicas mínimas.
- Validar comportamento para `/login` quando usuário já autenticado (redirect para `/`).

### Etapa 4 — Validação de fluxo ponta a ponta

- Acessar `/` sem cookie -> deve ir para `/login`.
- Login inválido -> `/login?error=1`.
- Login válido -> `/`.
- Logout pela topbar -> `/login`.
- Reacesso manual a `/login` autenticado -> `/`.

### Etapa 5 — Hardening opcional mínimo (sem mudar arquitetura)

- Opcional: padronizar resposta 303 para POST redirects (evita ambiguidades em alguns clientes).
- Opcional: pequena normalização de matcher para excluir arquivos estáticos extras, se necessário.
- Opcional: incluir teste manual de regressão para rotas `/api/news` e `/operacoes-combustivel` com sessão ativa.

## 8) Conclusão objetiva

- O projeto **já está** em App Router e **já possui** uma implementação simples de autenticação por cookie + middleware.
- O caminho de menor risco é **não criar nova arquitetura**, apenas validar/ajustar pontualmente o que já existe.
- Isso reduz drasticamente risco de conflito de rota, loops de middleware e inconsistência de navegação.
