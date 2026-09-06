import { NAV_ITEMS } from "@/data/commission-dashboard";
import { cn } from "@/lib/utils";
import type { TabId } from "@/types/commission-dashboard";

import { DashboardIcon } from "./icons";

export function CommissionSidebar({
  activeTab,
  onSelect,
}: {
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
}) {
  return (
    <aside className="relative flex w-full shrink-0 flex-col overflow-hidden bg-navy-950 lg:w-[248px]">
      <div className="pointer-events-none absolute right-0 top-0 h-full w-px bg-[linear-gradient(to_bottom,transparent,#163050_20%,#163050_80%,transparent)]" />

      <div className="flex h-[68px] items-center gap-3 border-b border-white/10 px-5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-[9px] border border-gold-400/35 bg-gold-500/10 text-gold-400 shadow-[inset_0_0_18px_rgba(212,160,23,0.08)]">
          <span className="font-heading text-lg font-bold leading-none">A</span>
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-navy-950 bg-gold-400" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-heading text-[18px] font-bold tracking-[1.2px] text-white">ARGUS</span>
          <span className="mt-1 text-[9px] font-semibold uppercase tracking-[2.4px] text-gold-400">COMISS</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <div className="px-5 pb-1 pt-3 text-[9px] font-bold uppercase tracking-[2px] text-white/30">Operação</div>
        <nav className="space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const active = item.id === activeTab;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[7px] px-3 py-2.5 text-left text-[13px] font-medium transition",
                  active
                    ? "bg-white/[0.09] text-white shadow-[inset_3px_0_0_#EBB92D]"
                    : "text-white/55 hover:bg-white/5 hover:text-white/90",
                )}
              >
                <DashboardIcon
                  name={item.icon}
                  className={cn("h-4 w-4 shrink-0", active ? "text-gold-400" : "text-white/65")}
                />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="block text-[9px] uppercase tracking-[1.4px] text-white/30">Ambiente</span>
            <span className="mt-1 block text-[11px] font-semibold text-white/65">Rede Horizonte</span>
          </div>
          <span className="rounded-full border border-success/25 bg-success/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.8px] text-emerald-300">Online</span>
        </div>
      </div>
    </aside>
  );
}
