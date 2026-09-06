import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionCookieName, validateSessionToken } from "@/lib/auth";
import { isSetupAvailable } from "@/lib/users";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; setup?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;

  if (await validateSessionToken(token)) {
    redirect("/");
  }

  const resolvedSearchParams = await searchParams;
  const hasError = resolvedSearchParams?.error === "1";
  const setupComplete = resolvedSearchParams?.setup === "success";
  const setupAvailable = await isSetupAvailable();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-950 px-4 py-10">
      <div className="pointer-events-none absolute -left-40 top-[-12rem] h-[34rem] w-[34rem] rounded-full border border-gold-400/10" />
      <div className="pointer-events-none absolute -bottom-64 -right-44 h-[40rem] w-[40rem] rounded-full border border-white/5" />
      <section className="relative w-full max-w-[440px] overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_28px_80px_rgba(0,0,0,0.35)]">
        <div className="border-b border-border bg-surface-2/70 px-8 py-7">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-gold-500/25 bg-navy-950 font-heading text-xl font-bold text-gold-400">A</div>
            <div className="leading-none">
              <p className="font-heading text-xl font-bold tracking-[1.4px] text-navy-950">ARGUS</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[2.8px] text-gold-600">COMISS</p>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Bem-vindo de volta</h1>
          <p className="mt-1.5 text-sm text-text-muted">Gestão inteligente de metas e premiação.</p>
        </div>

        <div className="p-8">
          {hasError ? (
            <p className="mb-4 rounded-2xl border border-danger/25 bg-danger/10 px-4 py-2 text-sm text-danger">
              Credenciais inválidas. Tente novamente.
            </p>
          ) : null}

          {setupComplete ? (
            <p className="mb-4 rounded-2xl border border-success/25 bg-success/10 px-4 py-2 text-sm text-success">
              Administrador criado. Entre com as novas credenciais.
            </p>
          ) : null}

          {setupAvailable ? (
            <div className="mb-5 rounded-2xl border border-gold-500/25 bg-gold-500/10 p-4 text-center">
              <p className="font-semibold text-text-primary">Configuração inicial necessária</p>
              <p className="mt-1 text-sm text-text-muted">Crie o primeiro administrador para começar.</p>
              <Link href="/setup" className="mt-3 inline-flex rounded-xl bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700">
                Configurar administrador
              </Link>
            </div>
          ) : null}

          <form action="/api/auth/login" method="post" className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-text-primary">E-mail</span>
              <input
                type="email"
                name="email"
                required
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none transition focus:border-gold-500"
                placeholder="seu@email.com.br"
                autoComplete="email"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-text-primary">Senha</span>
              <input
                type="password"
                name="password"
                required
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none transition focus:border-gold-500"
                placeholder="Sua senha"
                autoComplete="current-password"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-xl bg-navy-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/50"
            >
              Entrar
            </button>
          </form>
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-[11px] text-text-muted">
            <span>Ambiente protegido</span>
            <span className="font-semibold text-text-secondary">ARGUS COMISS</span>
          </div>
        </div>
      </section>
    </main>
  );
}
