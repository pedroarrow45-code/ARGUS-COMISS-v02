"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";

type FormValues = { name: string; email: string; password: string; passwordConfirmation: string };
const EMPTY_FORM: FormValues = { name: "", email: "", password: "", passwordConfirmation: "" };

export function SetupForm() {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  function update(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (values.password !== values.passwordConfirmation) {
      setError("A senha e a confirmação não coincidem.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível concluir a configuração.");
        return;
      }

      setIsComplete(true);
      setTimeout(() => router.push("/login?setup=success"), 1200);
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isComplete) {
    return (
      <div className="rounded-2xl border border-success/25 bg-success/10 px-4 py-4 text-center text-sm text-success" role="status">
        Administrador criado com sucesso. Redirecionando para o login…
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nome" type="text" value={values.name} onChange={(value) => update("name", value)} autoComplete="name" minLength={2} />
      <Field label="E-mail" type="email" value={values.email} onChange={(value) => update("email", value)} autoComplete="email" />
      <Field label="Senha" type="password" value={values.password} onChange={(value) => update("password", value)} autoComplete="new-password" minLength={8} hint="Use pelo menos 8 caracteres." />
      <Field label="Confirmar senha" type="password" value={values.passwordConfirmation} onChange={(value) => update("passwordConfirmation", value)} autoComplete="new-password" minLength={8} />

      {error ? <p className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-2 text-sm text-danger" role="alert">{error}</p> : null}

      <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-navy-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/50 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? "Criando administrador…" : "Criar administrador"}
      </button>
      <p className="text-center text-sm text-text-muted"><Link href="/login" className="font-medium text-navy-600 hover:text-navy-700">Voltar ao login</Link></p>
    </form>
  );
}

function Field({ label, hint, onChange, ...props }: { label: string; hint?: string; onChange: (value: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "name" | "required">) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      <input {...props} required onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand-500" />
      {hint ? <span className="block text-xs text-text-muted">{hint}</span> : null}
    </label>
  );
}
