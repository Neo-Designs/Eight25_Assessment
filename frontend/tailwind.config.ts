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
        primary: '#6366F1',
        'primary-hover': '#4F46E5',
        secondary: '#64748B',
        accent: '#8B5CF6',
        light: { bg: '#F8FAFC', surface: '#FFFFFF', text: '#0F172A' },
        dark: { bg: '#0F172A', surface: '#1E293B', text: '#E2E8F0' },
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
