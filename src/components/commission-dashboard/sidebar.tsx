import { NAV_ITEMS } from "@/data/commission-dashboard";
import { cn } from "@/lib/utils";
import type { TabId } from "@/types/commission-dashboard";

import { DashboardIcon } from "./icons";

export function CommissionSidebar({ activeTab, onSelect }: { activeTab: TabId; onSelect: (tab: TabId) => void }) {
  return (
    <aside className="relative z-20 flex w-full shrink-0 items-center border-b border-white/10 bg-navy-950 px-3 text-white lg:h-screen lg:w-[92px] lg:flex-col lg:border-b-0 lg:border-r lg:px-0">
      <div className="flex h-[64px] w-[68px] shrink-0 items-center justify-center border-white/10 lg:h-[92px] lg:w-full lg:border-b">
        <div className="text-center leading-none" aria-label="ARGUS COMISS">
          <span className="font-heading text-[19px] font-bold tracking-[1.5px]">ARGUS</span>
          <span className="mt-1 block text-[8px] font-bold tracking-[2.8px] text-gold-400">COMISS</span>
        </div>
      </div>

      <nav className="flex flex-1 items-center gap-1 overflow-x-auto py-2 lg:w-full lg:flex-col lg:justify-center lg:overflow-visible lg:py-6" aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeTab;
          return (
            <button key={item.id} type="button" onClick={() => onSelect(item.id)} aria-current={active ? "page" : undefined} title={item.label} className={cn("group relative flex h-[52px] min-w-[62px] flex-col items-center justify-center gap-1 text-[9px] font-medium text-white/45 outline-none transition lg:h-[62px] lg:w-full", active ? "text-white" : "hover:text-white/85")}>
              <span className={cn("absolute bottom-0 h-[2px] w-5 bg-gold-400 transition lg:bottom-auto lg:left-0 lg:h-7 lg:w-[2px]", active ? "opacity-100" : "opacity-0")} />
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-md transition", active ? "bg-white/10 text-gold-400" : "text-white/55 group-hover:bg-white/5")}>
                <DashboardIcon name={item.icon} className="h-[17px] w-[17px]" />
              </span>
              <span className="max-w-[78px] truncate">{item.label.replace(" / Exportação", "")}</span>
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex h-[64px] w-[58px] shrink-0 items-center justify-center lg:ml-0 lg:h-[92px] lg:w-full lg:border-t lg:border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-[10px] font-bold text-white/70" title="Administrador">AD</div>
      </div>
    </aside>
  );
}
