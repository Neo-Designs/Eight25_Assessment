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
        primary: '#1F4959',
        secondary: '#5C7C89',
        accent: '#A1C1C1',
        light: { bg: '#E6EFEF', surface: '#c3d7eb', text: '#121e26' },
        dark: { bg: '#112a2e', surface: '#162629', text: '#b2c2c2' },
        // Aliases for seamless layout switching
        background: 'var(--bg-color)',
        surface: 'var(--surface-color)',
        foreground: 'var(--text-color)'
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

