import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { CompanySummary } from "@/types/dashboard";

type CompanySummaryCardProps = {
  summary: CompanySummary;
};

export function CompanySummaryCard({ summary }: CompanySummaryCardProps) {
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-ink/45">{summary.company}</p>
          <h3 className="mt-2 break-words text-xl font-bold leading-tight tracking-tight">
            {formatCurrency(summary.currentValue)}
          </h3>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          {summary.projects} projetos
        </span>
      </div>

      <ProgressBar value={summary.progress} tone="accent" />

      <div className="grid grid-cols-2 gap-3 text-sm text-ink/65">
        <div>
          <p>Meta vinculada</p>
          <p className="mt-1 break-words font-semibold text-ink">{formatCurrency(summary.targetValue)}</p>
        </div>
        <div>
          <p>Progresso médio</p>
          <p className="mt-1 font-semibold text-ink">{formatPercent(summary.progress)}</p>
        </div>
      </div>
    </Card>
  );
}
