import type { TabId } from "@/types/commission-dashboard";

const TITLES: Record<TabId, string> = {
  dashboard: "Dashboard",
  unidades: "Unidades",
  funcionarios: "Funcionários",
  metas: "Metas",
  relatorios: "Relatórios",
  configuracoes: "Configurações",
};

export function CommissionTopbar({ activeTab }: { activeTab: TabId }) {
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="flex min-h-[60px] flex-col justify-between gap-3 border-b border-border bg-surface px-7 py-4 shadow-[0_1px_0_#DDE3EE] md:flex-row md:items-center">
      <div>
        <div className="text-[16px] font-bold tracking-[-0.2px] text-text-primary">
          POSTO BRASIL - Sistema de Gestão de Comissões
        </div>
        <div className="text-[11px] text-text-muted">
          {TITLES[activeTab]} · {today}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="rounded-full border border-border bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-text-primary transition hover:bg-bg"
          >
            Sair
          </button>
        </form>
        <div className="flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1.5 text-[11px] font-semibold text-success">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          Sistema online
        </div>
        <div
          title="Administrador"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#163050,#2A5A9E)] text-[12px] font-bold text-white"
        >
          AD
        </div>
      </div>
    </header>
  );
}
