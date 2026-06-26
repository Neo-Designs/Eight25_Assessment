import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: '#0EA5E9',
        'primary-hover': '#0284C7',
        secondary: '#64748B',
        accent: '#F97316',
        light: { bg: '#F8FAFC', surface: '#FFFFFF', text: '#0F172A' },
        dark: { bg: '#0B1121', surface: '#152033', text: '#E2E8F0' },
        // Aliases for seamless layout switching
        background: 'var(--bg-color)',
        surface: 'var(--surface-color)',
        foreground: 'var(--text-color)',
        muted: 'var(--muted-color)',
        border: 'var(--border-color)',
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
