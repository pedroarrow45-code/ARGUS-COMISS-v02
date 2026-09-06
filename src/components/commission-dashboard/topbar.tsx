import { MONTHS } from "@/data/commission-dashboard";
import type { TabId } from "@/types/commission-dashboard";

const TITLES: Record<TabId, string> = { dashboard: "Visão executiva", unidades: "Unidades", funcionarios: "Funcionários", metas: "Metas e resultados", relatorios: "Relatórios", configuracoes: "Configurações" };

export function CommissionTopbar({ activeTab, period, isClosed }: { activeTab: TabId; period: { year: number; month: number }; isClosed: boolean }) {
  return (
    <header className="px-5 pt-5 lg:px-8 lg:pt-7">
      <div className="flex flex-col justify-between gap-4 border-b border-border-dark pb-4 md:flex-row md:items-end">
        <div className="flex items-end gap-5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[2px] text-gold-600">Rede Horizonte</p>
            <h1 className="mt-1 font-heading text-[28px] font-bold leading-none tracking-[-0.3px] text-navy-950">{TITLES[activeTab]}</h1>
          </div>
          <span className="mb-0.5 hidden border-l border-border-dark pl-5 text-[10px] font-semibold uppercase tracking-[1.3px] text-text-muted sm:block">Central de performance</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.8px]">
          <div><span className="block text-[8px] font-bold text-text-muted">Competência</span><strong className="mt-0.5 block font-mono text-[12px] text-text-primary">{MONTHS[period.month - 1]} / {period.year}</strong></div>
          <div className="border-l border-border-dark pl-5"><span className="block text-[8px] font-bold text-text-muted">Estado</span><strong className={cnStatus(isClosed)}><i className="h-1.5 w-1.5 rounded-full bg-current" />{isClosed ? "Fechado" : "Aberto"}</strong></div>
          <div className="hidden border-l border-border-dark pl-5 sm:block"><span className="block text-[8px] font-bold text-text-muted">Sincronização</span><strong className="mt-0.5 block text-[11px] text-text-secondary">Atualizado agora</strong></div>
          <form action="/api/auth/logout" method="post"><button type="submit" className="border-l border-border-dark py-1 pl-5 text-[9px] font-bold text-text-muted hover:text-danger">Sair</button></form>
        </div>
      </div>
    </header>
  );
}

function cnStatus(isClosed: boolean) {
  return `mt-0.5 flex items-center gap-1.5 text-[11px] ${isClosed ? "text-navy-600" : "text-success"}`;
}
