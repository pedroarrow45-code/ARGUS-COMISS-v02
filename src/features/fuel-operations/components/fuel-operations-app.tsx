"use client";

import { useEffect, useMemo, useState } from "react";

import { APP_TABS } from "../catalog";
import { buildOperationalAlerts } from "../selectors";
import { useFuelOperationsStore } from "../store";
import type { AppTab } from "../types";
import { DashboardTab } from "./dashboard-tab";
import styles from "./fuel-operations.module.css";
import { NoticeBanner, cx } from "./shared";
import { OrdersTab } from "./orders-tab";
import { PlanningTab } from "./planning-tab";
import { SummaryTab } from "./summary-tab";
import { TrucksTab } from "./trucks-tab";

function formatClock(date: Date) {
  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  return `${time} | ${day}`;
}

export function FuelOperationsApp() {
  const [activeTab, setActiveTab] = useState<AppTab>("dashboard");
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [clock, setClock] = useState(() => formatClock(new Date()));
  const { trucks, orders, allocations, notice, clearNotice } = useFuelOperationsStore();

  useEffect(() => {
    const updateClock = () => setClock(formatClock(new Date()));
    const interval = window.setInterval(updateClock, 60000);
    updateClock();

    return () => window.clearInterval(interval);
  }, []);

  const alerts = useMemo(
    () => buildOperationalAlerts(trucks, orders, allocations),
    [allocations, orders, trucks],
  );

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>PB</div>
          <div>
            <p className={styles.logoTitle}>
              POSTO <span>BRASIL</span>
            </p>
            <p className={styles.logoSubtitle}>Operacao de cargas por caminhao-tanque</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.headerTime}>{clock}</span>
          <button className={styles.headerButton} onClick={() => setAlertsOpen((value) => !value)} type="button">
            Alertas
            {alerts.length > 0 ? <span className={styles.headerButtonDot}>{alerts.length}</span> : null}
          </button>
        </div>
      </header>

      <nav className={styles.navBar}>
        {APP_TABS.map((tab) => (
          <button
            key={tab.id}
            className={cx(styles.navTab, activeTab === tab.id && styles.navTabActive)}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <aside className={cx(styles.alertPanel, alertsOpen && styles.alertPanelOpen)}>
        <div className={styles.alertPanelHeader}>
          <div>
            <p className={styles.cardTitle}>Alertas operacionais</p>
            <p className={styles.cardSubtitle}>Pendencias e capacidade critica da operacao</p>
          </div>
          <button className={styles.ghostButton} onClick={() => setAlertsOpen(false)} type="button">
            Fechar
          </button>
        </div>
        <div className={styles.alertList}>
          {alerts.map((alert) => (
            <div className={styles.alertItem} key={alert.id}>
              <span className={cx(styles.alertTone, styles[`alertTone${alert.tone}` as keyof typeof styles])} />
              <div>
                <p className={styles.alertTitle}>{alert.title}</p>
                <p className={styles.alertDescription}>{alert.description}</p>
              </div>
            </div>
          ))}
          {alerts.length === 0 ? <p className={styles.emptyText}>Nenhum alerta ativo no momento.</p> : null}
        </div>
      </aside>

      <div className={styles.content}>
        {notice ? <NoticeBanner message={notice.message} onClose={clearNotice} tone={notice.tone} /> : null}
        {activeTab === "dashboard" ? <DashboardTab alerts={alerts} allocations={allocations} orders={orders} trucks={trucks} /> : null}
        {activeTab === "trucks" ? <TrucksTab allocations={allocations} trucks={trucks} /> : null}
        {activeTab === "orders" ? <OrdersTab allocations={allocations} orders={orders} /> : null}
        {activeTab === "planning" ? <PlanningTab allocations={allocations} orders={orders} trucks={trucks} /> : null}
        {activeTab === "summary" ? <SummaryTab allocations={allocations} orders={orders} trucks={trucks} /> : null}
      </div>
    </main>
  );
}
