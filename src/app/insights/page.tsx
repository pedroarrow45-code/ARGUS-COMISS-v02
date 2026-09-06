"use client";

import { Card } from "@/components/ui/card";
import { PageLoading } from "@/components/ui/page-loading";
import { generateInsights, type InsightTone } from "@/features/insights/utils/generate-insights";
import { formatPercent } from "@/lib/utils";
import { useProjectStore } from "@/store/project-store";

const toneStyles: Record<InsightTone, { badge: string; card: string; accent: string; label: string }> = {
  positive: {
    badge: "bg-brand-50 text-brand-700",
    card: "border-brand-100 bg-[linear-gradient(180deg,rgba(237,247,245,0.95),rgba(255,255,255,0.95))]",
    accent: "bg-brand-500",
    label: "Positivo",
  },
  alert: {
    badge: "bg-amber-100 text-amber-800",
    card: "border-amber-200 bg-[linear-gradient(180deg,rgba(255,247,237,0.95),rgba(255,255,255,0.95))]",
    accent: "bg-accent",
    label: "Alerta",
  },
  informative: {
    badge: "bg-ink/10 text-ink",
    card: "border-white/70 bg-white/95",
    accent: "bg-ink",
    label: "Informativo",
  },
};

export default function InsightsPage() {
  const projects = useProjectStore((state) => state.projects);
  const annualTarget = useProjectStore((state) => state.annualTarget);
  const isGlobalLoading = useProjectStore((state) => state.isGlobalLoading);

  if (isGlobalLoading) {
    return (
      <PageLoading
        variant="insights"
        title="Carregando insights..."
        message="Organizando a leitura executiva dos projetos."
      />
    );
  }

  const insights = generateInsights(projects, annualTarget);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card className="overflow-hidden bg-ink text-white">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                Leitura executiva
              </span>
              <div>
                <h1 className="max-w-2xl text-3xl font-bold leading-tight md:text-4xl">
                  Inteligência automática para leitura rápida da carteira e suporte a decisões executivas.
                </h1>
                <p className="mt-3 max-w-3xl text-sm text-white/72 md:text-base">
                  A aba Insights traduz os dados de projetos em sinais de desempenho, atenção e oportunidade com uma
                  linguagem mais gerencial.
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-white/55">Sinal central</p>
              <p className="mt-3 text-4xl font-bold">{formatPercent(insights.summary.annualCompletion)}</p>
              <p className="mt-2 text-sm text-white/70">da meta anual já foi capturada pela carteira atual.</p>
              <div className="mt-6 h-3 rounded-full bg-white/10">
                <div
                  className="h-3 rounded-full bg-accent transition-all"
                  style={{ width: `${Math.min(100, insights.summary.annualCompletion)}%` }}
                />
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-white/65">
                <span>Foco atual</span>
                <span>{insights.summary.totalProjects} projetos ativos na leitura</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Panorama</p>
          <h2 className="text-2xl font-bold">Painel de interpretação</h2>
          <p className="text-sm leading-6 text-ink/65">
            Os destaques abaixo usam a mesma base do sistema para mostrar desempenho, pressão sobre a meta e pontos
            que merecem ação executiva.
          </p>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {insights.primaryInsights.map((insight) => (
          <Card key={insight.title} className={`space-y-4 border ${toneStyles[insight.tone].card}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Insight-chave</p>
                <h2 className="mt-2 text-lg font-bold text-ink">{insight.title}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneStyles[insight.tone].badge}`}>
                {toneStyles[insight.tone].label}
              </span>
            </div>

            <div className={`h-1.5 w-20 rounded-full ${toneStyles[insight.tone].accent}`} />

            <div className="space-y-2">
              <p className="text-4xl font-bold tracking-tight text-ink">{insight.value}</p>
              <p className="text-sm leading-6 text-ink/65">{insight.helper}</p>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Observações estratégicas</p>
            <h2 className="mt-2 text-2xl font-bold">Leitura executiva da operação</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Uma camada de interpretação para destacar onde a carteira performa bem, onde pede intervenção e o que
              deve entrar no radar da liderança.
            </p>
          </div>

          <div className="space-y-3">
            {insights.strategicObservations.map((observation) => (
              <div
                key={`${observation.title}-${observation.helper}`}
                className={`rounded-[1.75rem] border p-5 ${toneStyles[observation.tone].card}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneStyles[observation.tone].badge}`}
                    >
                      {toneStyles[observation.tone].label}
                    </div>
                    <h3 className="text-lg font-bold text-ink">{observation.title}</h3>
                  </div>
                  <div className={`mt-2 h-3 w-3 rounded-full ${toneStyles[observation.tone].accent}`} />
                </div>

                <p className="mt-4 text-sm leading-6 text-ink/70">{observation.helper}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Radar executivo</p>
            <h2 className="mt-2 text-2xl font-bold">Indicadores de leitura rápida</h2>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.75rem] bg-sand p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/45">Atenção operacional</p>
              <p className="mt-3 text-3xl font-bold text-ink">{insights.summary.delayedProjectsCount}</p>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                projeto(s) estão abaixo de 50% de progresso e merecem priorização executiva.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-ink/8 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/45">Escopo analisado</p>
              <p className="mt-3 text-3xl font-bold text-ink">{insights.summary.totalProjects}</p>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                projeto(s) estão sendo considerados nesta leitura executiva da carteira.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-ink/8 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/45">Pressão sobre a meta</p>
              <p className="mt-3 text-3xl font-bold text-ink">{formatPercent(insights.summary.annualCompletion)}</p>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                de atingimento da meta anual já foi capturado pela carteira atual.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
