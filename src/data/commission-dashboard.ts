import type { NavItem } from "@/types/commission-dashboard";

export const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "unidades", label: "Unidades", icon: "units" },
  { id: "funcionarios", label: "Funcionários", icon: "users" },
  { id: "metas", label: "Metas", icon: "goals" },
  { id: "relatorios", label: "Relatórios / Exportação", icon: "reports" },
  { id: "configuracoes", label: "Configurações", icon: "settings" },
];

export const REPORT_YEARS = [2024, 2025, 2026];
