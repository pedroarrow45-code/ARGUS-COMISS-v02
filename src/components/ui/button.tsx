import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: "primary" | "secondary" | "ghost";
};

const styles = {
  primary:
    "bg-brand-500 text-white shadow-[0_12px_24px_rgba(31,122,107,0.2)] hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-[0_16px_28px_rgba(31,122,107,0.24)]",
  secondary:
    "bg-white text-ink ring-1 ring-ink/10 hover:-translate-y-0.5 hover:bg-white hover:ring-ink/15 hover:shadow-[0_12px_24px_rgba(19,33,43,0.08)]",
  ghost: "text-ink hover:bg-ink/6 hover:text-ink",
};

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold tracking-[0.01em] transition focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
