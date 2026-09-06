"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { PageLoading } from "@/components/ui/page-loading";
import { useProjectStore } from "@/store/project-store";

type NewsItem = {
  id: string;
  title: string;
  summary: string;
  date: string;
  source: string;
  href: string;
};

type NewsResponse = {
  articles?: NewsItem[];
  source?: "api" | "fallback";
  message?: string | null;
  error?: string | null;
};

export default function NewsPage() {
  const isGlobalLoading = useProjectStore((state) => state.isGlobalLoading);
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsMessage, setNewsMessage] = useState<string | null>(null);
  const [newsSource, setNewsSource] = useState<"api" | "fallback">("fallback");

  useEffect(() => {
    let active = true;

    async function loadNews() {
      setIsLoadingNews(true);
      setNewsError(null);
      setNewsMessage(null);

      try {
        const response = await fetch("/api/news", { cache: "no-store" });
        const data = (await response.json()) as NewsResponse;

        if (!active) {
          return;
        }

        setArticles(Array.isArray(data.articles) ? data.articles : []);
        setNewsSource(data.source === "api" ? "api" : "fallback");
        setNewsMessage(data.message ?? null);
        setNewsError(response.ok ? null : data.error ?? "Não foi possível carregar as notícias.");
      } catch (error) {
        if (!active) {
          return;
        }

        setArticles([]);
        setNewsSource("fallback");
        setNewsMessage("Não foi possível atualizar as notícias agora. Tente novamente em instantes.");
        setNewsError(error instanceof Error ? error.message : "Não foi possível carregar as notícias.");
      } finally {
        if (active) {
          setIsLoadingNews(false);
        }
      }
    }

    loadNews();

    return () => {
      active = false;
    };
  }, []);

  if (isGlobalLoading || isLoadingNews) {
    return (
      <PageLoading
        variant="news"
        title="Carregando notícias..."
        message="Preparando o hub de inteligência de mercado."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card className="overflow-hidden bg-ink text-white">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-5">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                Atualizações de mercado
              </span>
              <div>
                <h1 className="max-w-3xl text-3xl font-bold leading-tight md:text-4xl">Atualizações de Mercado</h1>
                <p className="mt-3 max-w-3xl text-sm text-white/72 md:text-base">
                  Startups, IA e inovação em destaque
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-white/55">Panorama editorial</p>
              <p className="mt-3 text-4xl font-bold">{articles.length}</p>
              <p className="mt-2 text-sm leading-6 text-white/70">
                {newsSource === "api"
                  ? "Leituras selecionadas em tempo real sobre inteligência artificial, inovação, startups e mercado tech."
                  : "Leituras de contingência para manter o acompanhamento do mercado disponível mesmo em caso de falha externa."}
              </p>
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Visão editorial</p>
          <h2 className="text-2xl font-bold">Radar do ecossistema tech</h2>
          <p className="text-sm leading-6 text-ink/65">
            Atualizações ordenadas por recência para acompanhar movimentos relevantes em tecnologia e inteligência
            artificial no dia a dia.
          </p>
        </Card>
      </section>

      {newsMessage ? (
        <Card className="space-y-3 border border-amber-200 bg-amber-50/70">
          <p className="text-xs uppercase tracking-[0.24em] text-amber-700">Modo de contingência</p>
          <h2 className="text-2xl font-bold text-amber-950">Atualizações exibidas com fallback seguro</h2>
          <p className="text-sm leading-6 text-amber-900/80">{newsMessage}</p>
        </Card>
      ) : null}

      {newsError && articles.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Erro de carregamento</p>
          <h2 className="text-2xl font-bold">Não foi possível atualizar as notícias</h2>
          <p className="text-sm leading-6 text-ink/65">
            O sistema continuou estável, mas a integração externa falhou neste momento.
          </p>
          <p className="text-sm leading-6 text-ink/55">{newsError}</p>
        </Card>
      ) : null}

      {!newsError && articles.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Sem resultados</p>
          <h2 className="text-2xl font-bold">Nenhuma notícia encontrada</h2>
          <p className="text-sm leading-6 text-ink/65">
            Tente novamente mais tarde para ver novas atualizações sobre IA, inovação e mercado tech.
          </p>
        </Card>
      ) : null}

      {articles.length > 0 ? (
        <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {articles.map((item, index) => (
            <Card
              key={item.id}
              className="group flex h-full flex-col justify-between border border-white/70 bg-white/92 p-0 transition duration-300 hover:-translate-y-1 hover:border-brand-100 hover:shadow-[0_18px_50px_rgba(19,33,43,0.12)]"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-ink/8 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">
                      Destaque
                    </span>
                    {index === 0 ? (
                      <span className="rounded-full bg-ink px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
                        Mais recente
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink/38">{item.date}</span>
                </div>

                <div className="flex flex-1 flex-col justify-between px-6 py-6">
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/42">{item.source}</p>
                      <h2 className="text-2xl font-bold leading-tight tracking-tight text-ink transition-colors group-hover:text-brand-700">
                        {item.title}
                      </h2>
                    </div>

                    <p className="text-sm leading-7 text-ink/65">{item.summary}</p>
                  </div>

                  <div className="mt-8 flex flex-col gap-4 border-t border-ink/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink/35">Fonte</p>
                      <p className="text-sm font-medium text-ink/65">{item.source}</p>
                    </div>

                    <Link
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
                    >
                      Ler mais
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}
