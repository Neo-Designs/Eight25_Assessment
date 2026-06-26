'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Radar, Home, Clock, GitCompare, ChevronLeft, ChevronRight, Activity,
} from 'lucide-react';

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
        bg-slate-950 border-r border-slate-900
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-60'}
      `}
      style={{ position: 'sticky', top: 0 }}
    >
      {/* ─── Logo ─────────────────────────────── */}
      <div className={`flex items-center h-16 px-4 border-b border-slate-900 gap-3 overflow-hidden`}>
        <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
          <Radar className="h-4 w-4 text-indigo-400" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="text-xs font-bold tracking-wider text-slate-200 whitespace-nowrap uppercase block">
              Audit Tool
            </span>
            <span className="text-[10px] text-slate-500 whitespace-nowrap">EIGHT25MEDIA</span>
          </div>
        )}
      </div>

      {/* ─── Section label ────────────────────── */}
      {!collapsed && (
        <div className="px-4 pt-4 pb-1">
          <span className="text-[10px] font-semibold tracking-widest text-slate-600 uppercase">Navigation</span>
        </div>
      )}

      {/* ─── Nav items ────────────────────────── */}
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
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }
              `}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold leading-none truncate">{item.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{item.description}</p>
                </div>
              )}
              {/* Active indicator dot */}
              {active && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ─── Status pill ──────────────────────── */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-slate-900">
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
            <Activity className="h-3 w-3 text-emerald-400" />
            <span>Backend :8000</span>
          </div>
        </div>
      )}

      {/* ─── Collapse toggle ──────────────────── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="
          absolute -right-3 top-1/2 -translate-y-1/2
          h-6 w-6 rounded-full
          bg-slate-900 border border-slate-800
          flex items-center justify-center
          text-slate-400 hover:text-white hover:border-indigo-500
          transition z-10
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
