import type { HistoricalPoint } from "@/types/commission-dashboard";

export function BarChart({ data }: { data: HistoricalPoint[] }) {
  if (data.length === 0) return <div className="flex h-full items-center justify-center text-xs text-text-muted">Sem histórico para exibir.</div>;

  const width = 720;
  const height = 230;
  const padding = { top: 28, right: 18, bottom: 32, left: 18 };
  const maxValue = Math.max(1, ...data.flatMap((point) => [point.goal, point.result])) * 1.08;
  const plotHeight = height - padding.top - padding.bottom;
  const step = (width - padding.left - padding.right) / data.length;
  const scaleY = (value: number) => padding.top + plotHeight - (value / maxValue) * plotHeight;
  const goalPoints = data.map((point, index) => `${padding.left + step * index + step / 2},${scaleY(point.goal)}`).join(" ");

  return (
    <div className="h-full w-full">
      <div className="mb-2 flex items-center gap-5 text-[10px] font-semibold uppercase tracking-[0.8px] text-text-muted">
        <span className="flex items-center gap-2"><i className="h-2 w-2 bg-navy-700" /> Resultado</span>
        <span className="flex items-center gap-2"><i className="h-px w-4 bg-gold-500" /> Meta</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-[calc(100%-1.5rem)] w-full overflow-visible" role="img" aria-label="Histórico de meta e resultado em litros">
        {[0.25, 0.5, 0.75, 1].map((factor) => (
          <line key={factor} x1={padding.left} x2={width - padding.right} y1={padding.top + plotHeight * (1 - factor)} y2={padding.top + plotHeight * (1 - factor)} stroke="#D8DEE8" strokeWidth="1" strokeDasharray="3 5" />
        ))}

        {data.map((point, index) => {
          const x = padding.left + step * index + step * 0.22;
          const y = scaleY(point.result);
          const completion = point.goal > 0 ? Math.round((point.result / point.goal) * 100) : 0;
          return (
            <g key={point.month}>
              <rect x={x} y={y} width={step * 0.56} height={padding.top + plotHeight - y} fill="#163050" opacity={index === data.length - 1 ? 1 : 0.72} rx="2" />
              <text x={x + step * 0.28} y={Math.max(12, y - 7)} textAnchor="middle" fontSize="10" fontWeight="600" fill="#4A5E7A">{completion}%</text>
              <text x={x + step * 0.28} y={height - 9} textAnchor="middle" fontSize="10" fontWeight="600" fill="#687891">{point.month}</text>
            </g>
          );
        })}

        <polyline points={goalPoints} fill="none" stroke="#D4A017" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {data.map((point, index) => <circle key={`goal-${point.month}`} cx={padding.left + step * index + step / 2} cy={scaleY(point.goal)} r="3" fill="#F1F3F6" stroke="#B8860B" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
      </svg>
    </div>
  );
}
