"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/projetos", label: "Projetos" },
  { href: "/insights", label: "Insights" },
  { href: "/noticias", label: "Notícias" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col justify-between rounded-[1.75rem] bg-ink px-5 py-6 text-white shadow-soft">
      <div className="space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/55">ARGUS GROUP</p>
          <h1 className="mt-3 text-[1.75rem] font-bold tracking-tight">Performance Hub</h1>
          <p className="mt-2 text-sm leading-6 text-white/72">Visão consolidada de resultados e projetos.</p>
        </div>

        <nav className="space-y-2.5">
          {navItems.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-2xl px-4 py-3 text-sm font-medium tracking-[0.01em] transition",
                  active
                    ? "bg-white text-ink shadow-[0_10px_24px_rgba(255,255,255,0.14)]"
                    : "text-white/72 hover:bg-white/10 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">Unidades</p>
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-white/72">ARGUS INTEL</span>
            <span className="font-semibold">BI & Estratégia</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/72">ARGUS SYSTEMS</span>
            <span className="font-semibold">Soluções & Tech</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
