import { redirect } from "next/navigation";

import { SetupForm } from "./setup-form";
import { isSetupAvailable } from "@/lib/users";

export default async function SetupPage() {
  if (!(await isSetupAvailable())) redirect("/login");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-950 px-4 py-10">
      <div className="pointer-events-none absolute -left-40 top-[-12rem] h-[34rem] w-[34rem] rounded-full border border-gold-400/10" />
      <section className="relative w-full max-w-md rounded-2xl border border-white/10 bg-surface p-8 shadow-[0_28px_80px_rgba(0,0,0,0.35)]">
        <div className="mb-7 space-y-2 text-center">
          <p className="font-heading text-lg font-bold tracking-[1.4px] text-navy-950">ARGUS <span className="text-gold-600">COMISS</span></p>
          <h1 className="text-2xl font-bold text-text-primary">Configuração inicial</h1>
          <p className="text-sm text-text-muted">Crie o administrador responsável por esta instalação.</p>
        </div>
        <SetupForm />
      </section>
    </main>
  );
}
