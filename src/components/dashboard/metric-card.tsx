import { Card } from "@/components/ui/card";

type MetricCardProps = {
  label: string;
  value: string;
  helper: string;
};

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <Card className="space-y-3">
      <p className="text-sm text-ink/55">{label}</p>
      <p className="break-words text-3xl font-bold leading-tight tracking-tight text-ink">{value}</p>
      <p className="text-sm text-ink/55">{helper}</p>
    </Card>
  );
}
