import { NextResponse } from "next/server";

import { mockNews, type NewsItem } from "@/data/mock-news";

type NewsApiArticle = {
  title?: string | null;
  description?: string | null;
  url?: string | null;
  publishedAt?: string | null;
  source?: {
    name?: string | null;
  } | null;
};

type NewsApiResponse = {
  status?: string;
  articles?: NewsApiArticle[];
  message?: string;
};

type SafeNewsResponse = {
  articles: NewsItem[];
  source: "api" | "fallback";
  message: string | null;
  error: string | null;
};

const NEWS_API_URL = "https://newsapi.org/v2/everything";
const SEARCH_QUERY =
  '"artificial intelligence" OR innovation OR "tech startups" OR startup OR "technology market" OR "mercado tech"';
const MAX_NEWS_ITEMS = 8;

function toSummary(description: string | null | undefined) {
  if (!description) {
    return "Leia a matéria completa para ver os detalhes desta atualização do mercado.";
  }

  return description.length > 180 ? `${description.slice(0, 177).trim()}...` : description;
}

function formatPublishedDate(date: string | null | undefined) {
  if (!date) {
    return "";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

function buildFallbackResponse(message: string, error: string | null): SafeNewsResponse {
  return {
    articles: mockNews.slice(0, MAX_NEWS_ITEMS),
    source: "fallback",
    message,
    error,
  };
}

function mapArticles(articles: NewsApiArticle[]): NewsItem[] {
  return articles
    .filter((article) => article.title && article.url)
    .map((article, index) => ({
      id: `${article.url ?? "news"}-${index}`,
      title: article.title ?? "Atualização de mercado",
      summary: toSummary(article.description),
      date: formatPublishedDate(article.publishedAt),
      source: article.source?.name ?? "Fonte não informada",
      href: article.url ?? "#",
    }))
    .slice(0, MAX_NEWS_ITEMS);
}

export async function GET() {
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    console.warn("[news-api] NEWS_API_KEY ausente. Usando fallback local.");

    return NextResponse.json(
      buildFallbackResponse(
        "Exibindo notícias de contingência porque a integração externa ainda não foi configurada.",
        "NEWS_API_KEY ausente.",
      ),
    );
  }

  try {
    const url = new URL(NEWS_API_URL);
    url.searchParams.set("q", SEARCH_QUERY);
    url.searchParams.set("language", "pt");
    url.searchParams.set("sortBy", "publishedAt");
    url.searchParams.set("pageSize", String(MAX_NEWS_ITEMS));

    const response = await fetch(url.toString(), {
      headers: {
        "X-Api-Key": apiKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[news-api] Falha na resposta da NewsAPI.", {
        status: response.status,
        statusText: response.statusText,
      });

      return NextResponse.json(
        buildFallbackResponse(
          "Exibindo notícias de contingência porque a fonte externa está indisponível no momento.",
          `NewsAPI respondeu com status ${response.status}.`,
        ),
      );
    }

    const data = (await response.json()) as NewsApiResponse;

    if (data.status !== "ok" || !Array.isArray(data.articles)) {
      console.error("[news-api] Payload inesperado recebido da NewsAPI.", {
        status: data.status,
        message: data.message,
      });

      return NextResponse.json(
        buildFallbackResponse(
          "Exibindo notícias de contingência porque a resposta da fonte externa veio em um formato inesperado.",
          data.message ?? "Payload inesperado da NewsAPI.",
        ),
      );
    }

    const articles = mapArticles(data.articles);

    if (articles.length === 0) {
      console.warn("[news-api] Nenhuma notícia válida retornada pela NewsAPI. Usando fallback.");

      return NextResponse.json(
        buildFallbackResponse(
          "Nenhuma notícia válida foi encontrada agora. Exibindo a seleção de contingência.",
          "A NewsAPI não retornou artigos utilizáveis.",
        ),
      );
    }

    console.info("[news-api] Notícias carregadas com sucesso.", {
      count: articles.length,
    });

    return NextResponse.json({
      articles,
      source: "api",
      message: null,
      error: null,
    } satisfies SafeNewsResponse);
  } catch (error) {
    console.error("[news-api] Erro inesperado ao buscar notícias.", error);

    return NextResponse.json(
      buildFallbackResponse(
        "Exibindo notícias de contingência porque ocorreu uma instabilidade na integração externa.",
        error instanceof Error ? error.message : "Erro inesperado ao carregar notícias.",
      ),
    );
  }
}
