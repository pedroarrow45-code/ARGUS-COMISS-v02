import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "navy-950": "#060E1D",
        "navy-900": "#0B1829",
        "navy-800": "#102038",
        "navy-700": "#163050",
        "navy-600": "#1D4170",
        "navy-500": "#2A5A9E",
        "gold-600": "#B8860B",
        "gold-500": "#D4A017",
        "gold-400": "#EBB92D",
        "gold-300": "#F5CC5A",
        bg: "#F1F3F6",
        surface: "#FFFFFF",
        "surface-2": "#F5F7FB",
        border: "#DDE3EE",
        "border-dark": "#C5CFE0",
        "text-primary": "#0D1B30",
        "text-secondary": "#4A5E7A",
        "text-muted": "#8A9BBB",
        success: "#1A9E5C",
        "success-bg": "#E8F7EF",
        danger: "#D63E3E",
        "danger-bg": "#FDEAEA",
        warning: "#C47D0A",
        "warning-bg": "#FEF3DC",
        "info-bg": "#E8F0FE",
      },
      fontFamily: {
        sans: ["var(--font-ibm-plex-sans)"],
        mono: ["var(--font-ibm-plex-mono)"],
        heading: ["var(--font-barlow-condensed)"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(10,24,50,0.06), 0 8px 24px rgba(10,24,50,0.045)",
      },
    },
  },
  plugins: [],
};

export default config;
