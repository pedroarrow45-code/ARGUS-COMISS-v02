import { redirect } from "next/navigation";

import { SetupForm } from "./setup-form";
import { isSetupAvailable } from "@/lib/users";

export default async function SetupPage() {
  if (!(await isSetupAvailable())) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 shadow-soft">
        <div className="mb-7 space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">ARGUS COMISS</p>
          <h1 className="text-2xl font-bold text-text-primary">Configuração inicial</h1>
          <p className="text-sm text-text-muted">Crie o administrador responsável por esta instalação.</p>
        </div>
        <SetupForm />
      </section>
    </main>
  );
}
