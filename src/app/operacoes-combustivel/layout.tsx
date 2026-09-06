import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans, JetBrains_Mono } from "next/font/google";

const dmSans = DM_Sans({
  variable: "--fuel-font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--fuel-font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "ARGUS COMISS | Operações de Combustível",
  description: "Modulo operacional para planejamento de pedidos e montagem de carga por caminhao-tanque.",
};

export default function FuelOperationsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className={`${dmSans.variable} ${jetBrainsMono.variable}`}>{children}</div>;
}
