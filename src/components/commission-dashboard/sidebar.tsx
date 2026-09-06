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
    <aside className="relative flex w-full shrink-0 flex-col overflow-hidden bg-navy-950 lg:w-[240px]">
      <div className="pointer-events-none absolute right-0 top-0 h-full w-px bg-[linear-gradient(to_bottom,transparent,#163050_20%,#163050_80%,transparent)]" />

      <div className="flex h-[60px] items-center gap-2.5 border-b border-white/10 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-gold-500 text-navy-950">
          <DashboardIcon name="fuel" className="h-[18px] w-[18px]" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-heading text-[15px] font-bold tracking-[0.5px] text-white">POSTO BRASIL</span>
          <span className="mt-1 text-[9px] font-medium uppercase tracking-[1.5px] text-gold-400">
            Gestão de Comissões
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <div className="px-5 pb-1 pt-3 text-[9px] font-bold uppercase tracking-[2px] text-white/25">Menu Principal</div>
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
                    ? "bg-[linear-gradient(135deg,#B8860B,#EBB92D)] text-navy-950 shadow-[0_2px_10px_rgba(212,160,23,0.3)]"
                    : "text-white/55 hover:bg-white/5 hover:text-white/85",
                )}
              >
                <DashboardIcon
                  name={item.icon}
                  className={cn("h-4 w-4 shrink-0", active ? "text-navy-950" : "text-white/75")}
                />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-white/10 px-5 py-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-[1px] text-white/25">Powered by</span>
          <span className="text-[11px] font-semibold tracking-[0.5px] text-white/45">ARGUS SYSTEMS</span>
        </div>
      </div>
    </aside>
  );
}
