# Auditoria da implementação atual de autenticação (sem nova arquitetura)

Data: 2026-04-06

Escopo auditado:
- `src/app/login/page.tsx`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/lib/auth.ts`
- `middleware.ts`
- topbar/header com botão de saída

## Checklist solicitado (1 a 9)

1. `/login` é apenas página visual?
   - **Sim**. Há renderização de UI de login e validação de sessão com redirect para `/` quando já autenticado.

2. `/api/auth/login` é apenas endpoint de login?
   - **Sim**. A rota trata credenciais, cria cookie e redireciona.
   - Observação: também há `GET` para redirecionamento defensivo (continua sendo endpoint, não página visual).

3. `/api/auth/logout` é apenas endpoint de logout?
   - **Sim**. Limpa o cookie e redireciona para `/login`.

4. O form de `/login` usa `POST` para `/api/auth/login`?
   - **Sim**.

5. O botão “Sair” usa `POST` para `/api/auth/logout`?
   - **Sim**.

6. O cookie tem nome único e consistente?
   - **Sim**. Nome único centralizado em `src/lib/auth.ts` (`pb_commission_session`) e reutilizado por login/logout/middleware/login-page.

7. O middleware lê o mesmo cookie criado no login?
   - **Sim**. Middleware usa `getSessionCookieName()` e `validateSessionToken()`.

8. As rotas públicas estão corretas?
   - **Em geral, sim**. Pública apenas a tríade necessária: `/login`, `/api/auth/login`, `/api/auth/logout`.

9. Há arquivo legado/duplicado/comportamento conflitante?
   - **Duplicação de rotas de auth: não encontrada**.
   - **Conflito potencial relevante encontrado**: redirects de rotas `POST` usam `NextResponse.redirect` sem status explícito, que por padrão é 307.

## Inconsistências encontradas

### Críticas (prioridade alta)

1) **Redirect pós-POST sem status 303**
- Em `POST /api/auth/login`, sucesso e erro usam redirect padrão (307).
- Em `POST /api/auth/logout`, redirect padrão (307).
- Risco: cliente repetir `POST` na URL de destino (`/` ou `/login`), gerando comportamento inconsistente (ex.: 405) dependendo do navegador/proxy.
- Impacto: principal fonte potencial de “comportamento inconsistente” no fluxo login/logout.

## Itens corretos/consistentes

- Separação de responsabilidades entre página visual e endpoints está correta.
- Form de login e ação de logout estão com método `POST`.
- Cookie de sessão está centralizado por utilitário compartilhado (nome e TTL).
- Middleware usa mesmo nome de cookie e mesma validação de token.
- Rotas públicas mínimas definidas sem exposição desnecessária.

## Arquivos corretos

- `src/app/login/page.tsx`
- `src/app/api/auth/login/route.ts` (estrutura geral)
- `src/app/api/auth/logout/route.ts` (estrutura geral)
- `src/lib/auth.ts`
- `middleware.ts`
- `src/components/commission-dashboard/topbar.tsx`

## Arquivos problemáticos (pontos pontuais)

- `src/app/api/auth/login/route.ts`
  - Redirects de respostas `POST` sem status 303 explícito.

- `src/app/api/auth/logout/route.ts`
  - Redirect de resposta `POST` sem status 303 explícito.

## Plano mínimo de correção (ordem)

1. Ajustar redirects nas rotas `POST` de auth para `303 See Other`.
   - `POST /api/auth/login`:
     - erro -> `/login?error=1` com 303
     - sucesso -> `/` com 303
   - `POST /api/auth/logout`:
     - sucesso -> `/login` com 303

2. Manter o restante da arquitetura exatamente igual.
   - Sem novos arquivos.
   - Sem refatoração de middleware.
   - Sem alteração de Prisma/layout/dependências.

3. Validar manualmente o fluxo:
   - `/` sem cookie -> `/login`
   - login inválido -> `/login?error=1`
   - login válido -> `/`
   - logout -> `/login`
