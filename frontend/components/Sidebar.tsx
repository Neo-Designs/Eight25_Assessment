'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Clock, GitCompare, ChevronLeft, ChevronRight, Activity,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    icon: <Home className="h-4 w-4" />,
    description: 'Configure & launch audit',
  },
  {
    label: 'Audit History',
    href: '/history',
    icon: <Clock className="h-4 w-4" />,
    description: 'Browse past audit logs',
  },
  {
    label: 'Drift Compare',
    href: '/drift',
    icon: <GitCompare className="h-4 w-4" />,
    description: 'Competitor page comparison',
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside
      className={`
        relative flex-shrink-0 flex flex-col h-screen
        bg-light-surface dark:bg-dark-surface border-r border-border
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-60'}
      `}
      style={{ position: 'sticky', top: 0 }}
    >
      {/* ─── Logo / Brand ──────────────────────────── */}
      <div className={`flex items-center h-16 px-4 border-b border-border gap-3 overflow-hidden`}>
        <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               className="h-4 w-4 text-primary" aria-hidden="true">
            <circle cx="12" cy="12" r="2"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M19.07 4.93l-2.83 2.83M7.76 16.24l-2.83 2.83"/>
            <path d="M12 10 L5 6M12 10 L19 6M12 14 L5 18M12 14 L19 18" strokeOpacity="0.5"/>
          </svg>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="text-xs font-bold tracking-wider text-light-text dark:text-dark-text whitespace-nowrap uppercase block">
              WebCrawler
            </span>
            <span className="text-[10px] text-secondary whitespace-nowrap">EIGHT25MEDIA</span>
          </div>
        )}
      </div>

      {/* ─── Section label ──────────────────────────── */}
      {!collapsed && (
        <div className="px-4 pt-4 pb-1">
          <span className="text-[10px] font-semibold tracking-widest text-secondary/60 uppercase">Navigation</span>
        </div>
      )}

      {/* ─── Nav items ──────────────────────────────── */}
      <nav className="flex-1 py-2 space-y-0.5 px-2 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              title={collapsed ? item.label : undefined}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
                transition-all duration-150 group relative
                ${active
                  ? 'bg-primary/10 text-primary border border-primary/25'
                  : 'text-secondary hover:text-light-text dark:hover:text-dark-text hover:bg-primary/5 border border-transparent'
                }
              `}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold leading-none truncate">{item.label}</p>
                  <p className="text-[10px] text-secondary mt-0.5 truncate">{item.description}</p>
                </div>
              )}
              {active && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ─── Theme Toggle + Status ───────────────────── */}
      <div className={`${collapsed ? 'px-2' : 'px-4'} py-3 border-t border-border space-y-2`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2 text-[10px] text-secondary font-mono">
              <Activity className="h-3 w-3 text-emerald-400" />
              <span>Backend :8000</span>
            </div>
          )}
          <ThemeToggle />
        </div>
      </div>

      {/* ─── Collapse toggle ─────────────────────────── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="
          absolute -right-3 top-1/2 -translate-y-1/2
          h-6 w-6 rounded-full
          bg-light-surface dark:bg-dark-surface border border-border
          flex items-center justify-center
          text-secondary hover:text-primary hover:border-primary/50
          transition z-10 shadow-sm
        "
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed
          ? <ChevronRight className="h-3 w-3" />
          : <ChevronLeft className="h-3 w-3" />
        }
      </button>
    </aside>
  );
}
