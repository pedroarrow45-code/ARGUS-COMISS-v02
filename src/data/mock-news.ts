export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  date: string;
  source: string;
  href: string;
};

export const mockNews: NewsItem[] = [
  {
    id: "news-001",
    title: "Fundo latino-americano anuncia novo ciclo de investimentos em startups de IA aplicada",
    summary:
      "Um novo veículo de capital mira startups B2B focadas em automação de processos, analytics e copilotos corporativos. O movimento reforça o interesse do mercado por soluções com ROI mais claro.",
    date: "17 mar. 2026",
    source: "Tech Capital Review",
    href: "#",
  },
  {
    id: "news-002",
    title: "Big tech amplia oferta de agentes de IA para operações internas e atendimento",
    summary:
      "Empresas de tecnologia aceleram o lançamento de agentes voltados para suporte, vendas e backoffice. A tendência indica uma nova fase de adoção prática de IA nas áreas operacionais.",
    date: "16 mar. 2026",
    source: "Mercado Digital",
    href: "#",
  },
  {
    id: "news-003",
    title: "Startup brasileira de dados industriais capta rodada para expandir automação preditiva",
    summary:
      "A empresa pretende ampliar sua presença em manufatura e logística com modelos preditivos para manutenção e eficiência operacional. Investidores apostam no crescimento da indústria conectada.",
    date: "15 mar. 2026",
    source: "Inovação Agora",
    href: "#",
  },
  {
    id: "news-004",
    title: "Mercado tech observa alta demanda por plataformas de governança de IA",
    summary:
      "Com mais empresas adotando modelos generativos, cresce a procura por ferramentas de auditoria, segurança e rastreabilidade. O tema passa a ganhar espaço em conselhos e lideranças executivas.",
    date: "14 mar. 2026",
    source: "Future Board",
    href: "#",
  },
  {
    id: "news-005",
    title: "Nova startup de infraestrutura para modelos leves chama atenção de investidores",
    summary:
      "A proposta combina custo reduzido, inferência otimizada e implantação mais simples para médias empresas. O segmento de IA eficiente entra no radar como alternativa ao consumo intensivo de recursos.",
    date: "13 mar. 2026",
    source: "Startup Wire",
    href: "#",
  },
  {
    id: "news-006",
    title: "Empresas aceleram projetos de automação financeira com apoio de machine learning",
    summary:
      "Áreas de controladoria e FP&A ampliam testes com modelos para previsões, reconciliação e detecção de desvios. A pauta ganha tração por combinar eficiência com ganho de visibilidade executiva.",
    date: "12 mar. 2026",
    source: "Finance Tech Brief",
    href: "#",
  },
  {
    id: "news-007",
    title: "Ecossistema de inovação corporativa prioriza startups com soluções de produtividade",
    summary:
      "Programas de venture client e inovação aberta passam a buscar startups com impacto direto em produtividade, margem e experiência do cliente. A seleção fica mais orientada a resultado.",
    date: "11 mar. 2026",
    source: "Corporate Innovation News",
    href: "#",
  },
  {
    id: "news-008",
    title: "Tendência de 2026 aponta integração entre analytics tradicional e IA generativa",
    summary:
      "Organizações começam a unificar painéis, dados operacionais e interfaces conversacionais para acelerar análises. O foco deixa de ser apenas experimentação e passa a mirar decisão mais rápida.",
    date: "10 mar. 2026",
    source: "AI Business Journal",
    href: "#",
  },
];
