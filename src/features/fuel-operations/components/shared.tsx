"use client";

import type { ReactNode } from "react";

import type { NoticeTone } from "../types";
import styles from "./fuel-operations.module.css";

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx(styles.card, className)}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <h2 className={styles.cardTitle}>{title}</h2>
          {subtitle ? <p className={styles.cardSubtitle}>{subtitle}</p> : null}
        </div>
        {actions ? <div className={styles.cardActions}>{actions}</div> : null}
      </div>
      <div className={cx(styles.cardBody, bodyClassName)}>{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  accent,
}: {
  label: string;
  value: string;
  helper?: string;
  accent?: string;
}) {
  return (
    <article className={styles.kpiCard}>
      <div className={styles.metricIcon}>{accent ?? "PB"}</div>
      <div>
        <p className={styles.kpiLabel}>{label}</p>
        <p className={styles.kpiValue}>{value}</p>
        {helper ? <p className={styles.kpiSub}>{helper}</p> : null}
      </div>
    </article>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: NoticeTone | "neutral";
  children: ReactNode;
}) {
  return <span className={cx(styles.badge, badgeToneClass[tone])}>{children}</span>;
}

const badgeToneClass: Record<NoticeTone | "neutral", string> = {
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  error: styles.badgeError,
  neutral: styles.badgeNeutral,
};

export function ProgressBar({
  value,
  color,
  thin,
}: {
  value: number;
  color?: string;
  thin?: boolean;
}) {
  return (
    <div className={cx(styles.progressTrack, thin && styles.progressTrackThin)}>
      <div className={styles.progressFill} style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

export function NoticeBanner({
  tone,
  message,
  onClose,
}: {
  tone: NoticeTone;
  message: string;
  onClose: () => void;
}) {
  return (
    <div className={cx(styles.noticeBanner, noticeToneClass[tone])}>
      <div>
        <p className={styles.noticeLabel}>{tone === "success" ? "Atualizacao" : tone === "warning" ? "Atencao" : "Erro"}</p>
        <p className={styles.noticeMessage}>{message}</p>
      </div>
      <button className={styles.ghostButton} onClick={onClose} type="button">
        Fechar
      </button>
    </div>
  );
}

const noticeToneClass: Record<NoticeTone, string> = {
  success: styles.noticeSuccess,
  warning: styles.noticeWarning,
  error: styles.noticeError,
};

export function SectionLead({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.sectionLead}>
      <h1 className={styles.sectionTitle}>{title}</h1>
      <p className={styles.sectionText}>{text}</p>
    </div>
  );
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyText}>{text}</p>
      {action}
    </div>
  );
}
