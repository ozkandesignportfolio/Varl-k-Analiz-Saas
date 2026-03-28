import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "bg-base": "#080D1A",
        "bg-surface": "#0E1525",
        "bg-elevated": "#141D30",
        "border-subtle": "#1E293B",
        "border-glow": "#334155",
        "accent-primary": "#6366F1",
        "accent-secondary": "#8B5CF6",
        "accent-cyan": "#06B6D4",
        "text-primary": "#F1F5F9",
        "text-secondary": "#94A3B8",
        "text-muted": "#475569",
      },
      fontFamily: {
        display: ["var(--font-inter)", "ui-sans-serif", "sans-serif"],
        sans: ["var(--font-inter)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
        metrics: ["var(--font-jetbrains-mono)", "monospace"],
      },
    },
  },
};

export default config;
