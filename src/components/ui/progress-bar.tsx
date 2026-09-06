import { cn } from "@/lib/utils";

type ProgressBarProps = {
  value: number;
  tone?: "brand" | "accent";
};

export function ProgressBar({ value, tone = "brand" }: ProgressBarProps) {
  return (
    <div className="h-3 rounded-full bg-ink/10">
      <div
        className={cn(
          "h-3 rounded-full transition-all",
          tone === "brand" ? "bg-brand-500" : "bg-accent",
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
