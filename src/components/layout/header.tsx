export function Header() {
  return (
    <header className="flex items-center justify-between rounded-[1.75rem] border border-white/80 bg-white/88 px-6 py-4 shadow-soft backdrop-blur">
      <div>
        <p className="section-eyebrow">Painel executivo</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-ink md:text-2xl">
          Gestão de resultados empresariais
        </h2>
      </div>

      <div className="text-right">
        <p className="text-sm font-semibold tracking-[0.02em] text-ink">ARGUS GROUP</p>
        <p className="text-sm text-ink/55">Dashboard integrado com projetos</p>
      </div>
    </header>
  );
}
