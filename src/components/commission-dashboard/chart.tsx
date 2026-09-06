import type { HistoricalPoint } from "@/types/commission-dashboard";

export function BarChart({ data }: { data: HistoricalPoint[] }) {
  const maxValue = Math.max(...data.flatMap((point) => [point.goal, point.result]));
  const width = 500;
  const height = 160;
  const padding = { top: 8, right: 8, bottom: 28, left: 8 };
  const barWidth = (width - padding.left - padding.right) / (data.length * 2 + data.length - 1);

  const scaleY = (value: number) => height - padding.bottom - (value / maxValue) * (height - padding.top - padding.bottom);
  const barHeight = (value: number) => (value / maxValue) * (height - padding.top - padding.bottom);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="goalGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1D4170" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#2A5A9E" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="resultGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4A017" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#B8860B" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75, 1].map((factor) => (
        <line
          key={factor}
          x1={padding.left}
          x2={width - padding.right}
          y1={height - padding.bottom - factor * (height - padding.top - padding.bottom)}
          y2={height - padding.bottom - factor * (height - padding.top - padding.bottom)}
          stroke="#DDE3EE"
          strokeWidth="1"
        />
      ))}

      {data.map((point, index) => {
        const groupWidth = barWidth * 2 + barWidth * 0.4;
        const x = padding.left + index * (groupWidth + barWidth * 0.5);

        return (
          <g key={point.month}>
            <rect x={x} y={scaleY(point.goal)} width={barWidth} height={barHeight(point.goal)} fill="url(#goalGradient)" rx="2" />
            <rect
              x={x + barWidth + barWidth * 0.2}
              y={scaleY(point.result)}
              width={barWidth}
              height={barHeight(point.result)}
              fill="url(#resultGradient)"
              rx="2"
            />
            <text x={x + barWidth + barWidth * 0.1} y={height - 8} textAnchor="middle" fontSize="9" fill="#8A9BBB">
              {point.month}
            </text>
          </g>
        );
      })}

      <rect x={width - 110} y={8} width={8} height={8} fill="url(#goalGradient)" rx="1" />
      <text x={width - 98} y={16} fontSize="9" fill="#8A9BBB">
        Meta
      </text>
      <rect x={width - 60} y={8} width={8} height={8} fill="url(#resultGradient)" rx="1" />
      <text x={width - 48} y={16} fontSize="9" fill="#8A9BBB">
        Resultado
      </text>
    </svg>
  );
}
