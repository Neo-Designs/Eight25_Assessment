'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'webcrawler-theme';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // On mount, read persisted preference → apply class
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = stored === 'dark' || (!stored && prefersDark);

    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
  };

  // Prevent hydration flash — render a stable placeholder until JS runs
  if (!mounted) {
    return <div className="h-9 w-9 rounded-xl bg-light-surface dark:bg-dark-surface border border-primary/20" />;
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Light Mode' : 'Dark Mode'}
      className="
        h-9 w-9 flex items-center justify-center rounded-xl
        bg-light-surface dark:bg-dark-surface border border-primary/20
        text-secondary hover:text-primary hover:border-primary/50
        transition-all duration-200
        focus-visible:outline-2 focus-visible:outline-primary
      "
    >
      {isDark
        ? <Sun  className="h-4 w-4" />
        : <Moon className="h-4 w-4" />
      }
    </button>
  );
}

