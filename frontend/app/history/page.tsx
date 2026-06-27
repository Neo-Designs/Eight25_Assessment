'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock, ChevronRight, RefreshCw,
  WifiOff, TrendingUp, GitCompare,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

interface HistoryItem {
  id: number;
  timestamp: string | null;
  url: string;
  seo_score: number | null;
}

type FetchState = 'idle' | 'loading' | 'error' | 'success';

function getScoreColor(score: number | null) {
  if (score === null) return 'text-secondary bg-secondary/10 border-secondary/20';
  if (score >= 85) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (score >= 60) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
}

function ScoreBadge({ score }: { score: number | null }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-bold font-mono ${getScoreColor(score)}`}>
      {score !== null ? `${score}/100` : 'N/A'}
    </span>
  );
}

export default function HistoryPage() {
  const router = useRouter();

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyState, setHistoryState] = useState<FetchState>('idle');
  const [historyError, setHistoryError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryState('loading');
    setHistoryError(null);
    try {
      const data = await apiFetch<HistoryItem[]>('/api/history', {
        signal: AbortSignal.timeout(10_000),
      });
      setHistoryItems(data);
      setHistoryState('success');
    } catch (err: unknown) {
      const isOffline = err instanceof TypeError && err.message.toLowerCase().includes('fetch');
      setHistoryError(
        isOffline
          ? 'Cannot reach backend (process.env.NEXT_PUBLIC_API_URL). Is the FastAPI server running?'
          : (err instanceof Error ? err.message : 'Unexpected error while loading history.')
      );
      setHistoryState('error');
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleOpenDetail = (item: HistoryItem) => {
    router.push(`/detail/${item.id}`);
  };

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text selection:bg-primary selection:text-white pb-16">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-border bg-light-bg/80 dark:bg-dark-bg/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-bold text-sm text-light-text dark:text-dark-text block leading-none">Audit History</span>
            <span className="text-[10px] text-secondary">All past audit runs logged from the database</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => router.push('/drift')}
              className="flex items-center gap-2 px-3 py-2 bg-light-surface dark:bg-dark-surface border border-border rounded-xl text-secondary hover:text-light-text dark:hover:text-dark-text hover:border-primary/40 transition text-xs"
            >
              <GitCompare className="h-3.5 w-3.5" />
              <span>Drift Compare</span>
            </button>
            <button
              onClick={fetchHistory}
              disabled={historyState === 'loading'}
              className="flex items-center gap-2 px-3 py-2 bg-light-surface dark:bg-dark-surface border border-border rounded-xl hover:border-primary/40 text-secondary hover:text-light-text dark:hover:text-dark-text transition text-xs disabled:opacity-50"
              title="Refresh history"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${historyState === 'loading' ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Count label */}
        {historyState === 'success' && (
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-light-text dark:text-dark-text">Historical Audit Logs</h1>
            <span className="text-[10px] font-mono text-secondary bg-light-surface dark:bg-dark-surface border border-border px-2 py-0.5 rounded-full">
              {historyItems.length} {historyItems.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
        )}

        {/* Loading skeleton */}
        {historyState === 'loading' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-light-surface dark:bg-dark-surface border border-border p-5 rounded-2xl animate-pulse">
                <div className="h-2.5 bg-secondary/20 rounded w-1/3 mb-3" />
                <div className="h-3 bg-secondary/20 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {historyState === 'error' && (
          <div className="flex flex-col items-center justify-center py-16 bg-light-surface dark:bg-dark-surface border border-dashed border-rose-500/20 rounded-3xl text-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <WifiOff className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-400">Failed to load history</p>
              <p className="text-xs text-secondary mt-1 max-w-sm">{historyError}</p>
            </div>
            <button
              onClick={fetchHistory}
              className="flex items-center gap-2 px-4 py-2 bg-light-surface dark:bg-dark-surface border border-border rounded-xl text-xs text-secondary hover:text-light-text dark:hover:text-dark-text hover:border-primary/40 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {historyState === 'success' && historyItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-light-surface dark:bg-dark-surface border border-dashed border-border rounded-3xl gap-4">
            <div className="h-12 w-12 rounded-2xl bg-light-surface dark:bg-dark-surface border border-border flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-secondary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-secondary">No audits yet</p>
              <p className="text-xs text-secondary/60 mt-1">Run your first audit from the Home page to populate history.</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/25 rounded-xl text-xs text-primary hover:bg-primary/20 transition"
            >
              Run an audit &rarr;
            </button>
          </div>
        )}

        {/* Populated history list */}
        {historyState === 'success' && historyItems.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {historyItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleOpenDetail(item)}
                className="bg-light-surface dark:bg-dark-surface border border-border hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 p-5 rounded-2xl transition-all flex items-center justify-between group text-left w-full"
              >
                <div className="space-y-1.5 truncate pr-4 flex-1">
                  <div className="flex items-center gap-2 text-[10px] text-secondary font-mono">
                    <span className="text-primary/70">#{item.id}</span>
                    <span>&middot;</span>
                    <span>{item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}</span>
                  </div>
                  <p className="font-semibold text-sm text-light-text dark:text-dark-text truncate font-mono group-hover:text-primary transition">
                    {item.url}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <ScoreBadge score={item.seo_score} />
                  <ChevronRight className="h-4 w-4 text-secondary group-hover:text-primary transition" />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-light-surface/70 dark:bg-dark-surface/70 py-6 text-center text-xs text-secondary">
        &copy; 2026 EIGHT25MEDIA &middot; WebCrawler — Professional SEO &amp; Conversion Audit Platform
      </footer>
    </div>
  );
}
