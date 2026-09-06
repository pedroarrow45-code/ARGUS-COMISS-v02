"use client";

import { useCallback, useEffect, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

import { DashboardIcon } from "./icons";

export type BadgeTone = "green" | "red" | "gold" | "navy" | "gray";

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "gold" | "outline" | "danger" | "success";
  size?: "md" | "sm";
  className?: string;
  type?: "button" | "submit";
  title?: string;
  onClick?: () => void;
};

type CardProps = {
  children: ReactNode;
  className?: string;
};

type CardSectionProps = {
  children: ReactNode;
  className?: string;
};

type BadgeProps = {
  children: ReactNode;
  tone: BadgeTone;
  className?: string;
};

type ProgressBarProps = {
  value: number;
  tone: "green" | "gold" | "navy" | "red";
  className?: string;
};

type ModalProps = {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
  fullscreen?: boolean;
};

type AlertProps = {
  children: ReactNode;
  tone: "info" | "warn";
  className?: string;
};

export function ShellButton({
  children,
  variant = "primary",
  size = "md",
  className,
  type = "button",
  title,
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[6px] border text-[13px] font-semibold transition duration-200",
        size === "md" ? "px-4 py-2" : "px-2.5 py-1.5 text-[11px]",
        variant === "primary" && "border-transparent bg-navy-800 text-white hover:-translate-y-px hover:bg-navy-700",
        variant === "gold" &&
          "border-transparent bg-[linear-gradient(135deg,#B8860B,#EBB92D)] text-navy-950 hover:-translate-y-px hover:opacity-90",
        variant === "outline" && "border-border-dark bg-transparent text-text-primary hover:bg-surface-2",
        variant === "danger" &&
          "border-red-200 bg-danger-bg text-danger hover:border-danger hover:bg-danger hover:text-white",
        variant === "success" &&
          "border-green-200 bg-success-bg text-success hover:border-success hover:bg-success hover:text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PanelCard({ children, className }: CardProps) {
  return <div className={cn("rounded-[10px] border border-border bg-surface shadow-panel", className)}>{children}</div>;
}

export function PanelCardHeader({ children, className }: CardSectionProps) {
  return <div className={cn("flex items-center justify-between border-b border-border px-5 py-4", className)}>{children}</div>;
}

export function PanelCardBody({ children, className }: CardSectionProps) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function StatusBadge({ children, tone, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "green" && "bg-success-bg text-success",
        tone === "red" && "bg-danger-bg text-danger",
        tone === "gold" && "bg-gold-500/12 text-gold-600",
        tone === "navy" && "bg-navy-600/10 text-navy-600",
        tone === "gray" && "border border-border bg-surface-2 text-text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({ value, tone, className }: ProgressBarProps) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-border", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          tone === "green" && "bg-[linear-gradient(90deg,#1A9E5C,#30D17A)]",
          tone === "gold" && "bg-[linear-gradient(90deg,#B8860B,#F5CC5A)]",
          tone === "navy" && "bg-[linear-gradient(90deg,#1D4170,#2A5A9E)]",
          tone === "red" && "bg-[linear-gradient(90deg,#D63E3E,#F87171)]",
        )}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

export function Avatar({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#163050,#2A5A9E)] text-[10px] font-bold text-white",
        className,
      )}
    >
      {label}
    </div>
  );
}

export function EmptyState({ icon, message, colSpan }: { icon: ReactNode; message: string; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="py-12 text-center text-text-muted">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center opacity-30">{icon}</div>
          <p className="text-[13px]">{message}</p>
        </div>
      </td>
    </tr>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
      <div>
        <h2 className="text-[20px] font-bold text-text-primary">{title}</h2>
        <p className="mt-0.5 text-[13px] text-text-secondary">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-[6px] border border-border-dark bg-surface px-3 py-[9px] text-[13px] text-text-primary outline-none transition focus:border-navy-600 focus:ring-4 focus:ring-navy-600/10",
        props.className,
      )}
    />
  );
}

function formatThousands(raw: string) {
  const normalized = raw.replace(/[^\d.]/g, "");
  if (!normalized) return "";

  const hasTrailingDecimal = normalized.endsWith(".");
  const [intPartRaw = "", ...decParts] = normalized.split(".");
  const decPartRaw = decParts.join("");
  const intPart = (intPartRaw || "0").replace(/^0+(?=\d)/, "");
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (hasTrailingDecimal) {
    return `${formatted},`;
  }

  return decPartRaw ? `${formatted},${decPartRaw}` : formatted;
}

function normalizeNumericRaw(raw: string, maxDecimalDigits?: number) {
  const clean = raw.replace(/[^\d.]/g, "");
  if (!clean) return "";

  const separatorIndex = clean.indexOf(".");
  const hasDecimal = separatorIndex >= 0;
  const integerPart = (hasDecimal ? clean.slice(0, separatorIndex) : clean).replace(/^0+(?=\d)/, "");
  const decimalPart = hasDecimal ? clean.slice(separatorIndex + 1).replace(/[^\d]/g, "") : "";
  const limitedDecimalPart =
    maxDecimalDigits === undefined ? decimalPart : decimalPart.slice(0, Math.max(0, maxDecimalDigits));
  const endsWithSeparator = hasDecimal && separatorIndex === clean.length - 1;
  const normalizedInteger = integerPart || (limitedDecimalPart || endsWithSeparator ? "0" : "");

  if (!hasDecimal) {
    return normalizedInteger;
  }

  if (endsWithSeparator) {
    return `${normalizedInteger}.`;
  }

  return limitedDecimalPart ? `${normalizedInteger}.${limitedDecimalPart}` : normalizedInteger;
}

function parseNumericDisplay(raw: string, maxDecimalDigits?: number) {
  const clean = raw.replace(/\./g, "").replace(/[^\d,]/g, "");
  if (!clean) return "";

  const separatorIndex = clean.indexOf(",");
  const hasDecimal = separatorIndex >= 0;
  const integerPart = (hasDecimal ? clean.slice(0, separatorIndex) : clean).replace(/^0+(?=\d)/, "");
  const decimalPart = hasDecimal ? clean.slice(separatorIndex + 1).replace(/[^\d]/g, "") : "";
  const limitedDecimalPart =
    maxDecimalDigits === undefined ? decimalPart : decimalPart.slice(0, Math.max(0, maxDecimalDigits));
  const endsWithSeparator = hasDecimal && separatorIndex === clean.length - 1;
  const normalizedInteger = integerPart || (limitedDecimalPart || endsWithSeparator ? "0" : "");

  if (!hasDecimal) {
    return normalizedInteger;
  }

  if (endsWithSeparator) {
    return `${normalizedInteger}.`;
  }

  return limitedDecimalPart ? `${normalizedInteger}.${limitedDecimalPart}` : normalizedInteger;
}

type NumberInputProps = {
  value: string;
  onValueChange: (raw: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  maxDecimalDigits?: number;
};

export function NumberInput({ value, onValueChange, disabled, className, placeholder, maxDecimalDigits }: NumberInputProps) {
  const toDisplay = useCallback((raw: string) => {
    if (!raw) return "";
    return formatThousands(normalizeNumericRaw(raw, maxDecimalDigits));
  }, [maxDecimalDigits]);

  const [display, setDisplay] = useState(() => toDisplay(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDisplay(toDisplay(value));
    }
  }, [focused, toDisplay, value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const normalized = parseNumericDisplay(e.target.value, maxDecimalDigits);
    setDisplay(toDisplay(normalized));
    onValueChange(normalized);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      disabled={disabled}
      placeholder={placeholder}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
      }}
      className={cn(
        "w-full rounded-[6px] border border-border-dark bg-surface px-3 py-[9px] text-[13px] text-text-primary outline-none transition focus:border-navy-600 focus:ring-4 focus:ring-navy-600/10",
        className,
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full cursor-pointer rounded-[6px] border border-border-dark bg-surface px-3 py-[9px] text-[13px] text-text-primary outline-none transition focus:border-navy-600 focus:ring-4 focus:ring-navy-600/10",
        props.className,
      )}
    />
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="mb-3 flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-col gap-2 md:flex-row">{children}</div>;
}

export function SearchField({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative flex-1">
      <DashboardIcon
        name="search"
        className="pointer-events-none absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-text-muted"
      />
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="pl-8"
      />
    </div>
  );
}

export function AlertBox({ children, tone, className }: AlertProps) {
  return (
    <div
      className={cn(
        "rounded-[6px] border px-3.5 py-2.5 text-[12px]",
        tone === "info" && "border-blue-200 bg-info-bg text-blue-700",
        tone === "warn" && "border-amber-200 bg-warning-bg text-warning",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Modal({ title, children, footer, onClose, wide, fullscreen }: ModalProps) {
  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [fullscreen]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-navy-950/55 backdrop-blur-[3px]",
        fullscreen ? "p-0" : "p-4",
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={cn(
          "flex w-full flex-col bg-surface shadow-[0_20px_60px_rgba(6,14,29,0.3)]",
          fullscreen
            ? "h-dvh w-screen max-h-none max-w-none overflow-hidden rounded-none"
            : "max-h-[calc(100vh-2rem)] rounded-xl",
          !fullscreen && (wide ? "max-w-[1100px]" : "max-w-[480px]"),
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-5 py-3.5 sm:px-6">
          <span className="min-w-0 truncate text-[16px] font-bold text-text-primary" title={title}>{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-border text-text-muted transition hover:bg-surface-2 hover:text-text-primary"
          >
            <DashboardIcon name="close" className="h-[14px] w-[14px]" />
          </button>
        </div>
        <div className={cn("px-6 py-5", fullscreen ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "overflow-y-auto")}>{children}</div>
        {footer ? <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-surface px-5 py-3 sm:px-6">{footer}</div> : null}
      </div>
    </div>
  );
}
