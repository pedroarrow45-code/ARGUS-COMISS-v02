import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionCookieName, validateSessionToken } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;

  if (await validateSessionToken(token)) {
    redirect("/");
  }

  const resolvedSearchParams = await searchParams;
  const hasError = resolvedSearchParams?.error === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 shadow-soft">
        <div className="mb-7 space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">POSTO BRASIL</p>
          <h1 className="text-2xl font-bold text-text-primary">Acesso à Plataforma de Comissão</h1>
          <p className="text-sm text-text-muted">Entre com seu e-mail e senha para continuar.</p>
        </div>

        {hasError ? (
          <p className="mb-4 rounded-2xl border border-danger/25 bg-danger/10 px-4 py-2 text-sm text-danger">
            Credenciais inválidas. Tente novamente.
          </p>
        ) : null}

        <form action="/api/auth/login" method="post" className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-text-primary">E-mail</span>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand-500"
              placeholder="admin@autopostobrasil.com"
              autoComplete="email"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-text-primary">Senha</span>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand-500"
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
      </section>
    </main>
  );
}
