'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock, ExternalLink, ChevronRight, RefreshCw, Loader2,
  WifiOff, TrendingUp, GitCompare,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface HistoryItem {
  id: number;
  timestamp: string | null;
  url: string;
  seo_score: number | null;
}

type FetchState = 'idle' | 'loading' | 'error' | 'success';

function getScoreColor(score: number | null) {
  if (score === null) return 'text-slate-400 bg-slate-900 border-slate-800';
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
      const res = await fetch(`${API_BASE}/api/history`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Server error ${res.status}`);
      }
      const data: HistoryItem[] = await res.json();
      setHistoryItems(data);
      setHistoryState('success');
    } catch (err: any) {
      const isOffline = err instanceof TypeError && err.message.toLowerCase().includes('fetch');
      setHistoryError(
        isOffline
          ? 'Cannot reach backend (http://localhost:8000). Is the FastAPI server running?'
          : err.message ?? 'Unexpected error while loading history.'
      );
      setHistoryState('error');
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleOpenDetail = (item: HistoryItem) => {
    const stub = {
      log_id: item.id,
      url: item.url,
      seo_score: item.seo_score,
      audit_output: null,
    };
    sessionStorage.setItem(`audit-${item.id}`, JSON.stringify(stub));
    router.push(`/detail/${item.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white pb-16">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <Clock className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <span className="font-bold text-sm text-slate-200 block leading-none">Audit History</span>
            <span className="text-[10px] text-slate-500">All past audit runs logged from the database</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => router.push('/drift')}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-indigo-500/40 transition text-xs"
            >
              <GitCompare className="h-3.5 w-3.5" />
              <span>Drift Compare</span>
            </button>
            <button
              onClick={fetchHistory}
              disabled={historyState === 'loading'}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition text-xs disabled:opacity-50"
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
            <h1 className="text-sm font-bold text-white">Historical Audit Logs</h1>
            <span className="text-[10px] font-mono text-slate-600 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
              {historyItems.length} {historyItems.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
        )}

        {/* Loading skeleton */}
        {historyState === 'loading' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-slate-900/40 border border-slate-900 p-5 rounded-2xl animate-pulse">
                <div className="h-2.5 bg-slate-800 rounded w-1/3 mb-3" />
                <div className="h-3 bg-slate-800 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {historyState === 'error' && (
          <div className="flex flex-col items-center justify-center py-16 bg-slate-900/20 border border-dashed border-rose-500/20 rounded-3xl text-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <WifiOff className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-400">Failed to load history</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">{historyError}</p>
            </div>
            <button
              onClick={fetchHistory}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 hover:text-white hover:border-indigo-500 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {historyState === 'success' && historyItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-900/10 border border-dashed border-slate-900 rounded-3xl gap-4">
            <div className="h-12 w-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-400">No audits yet</p>
              <p className="text-xs text-slate-600 mt-1">Run your first audit from the Home page to populate history.</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-xs text-indigo-400 hover:bg-indigo-600/30 transition"
            >
              Run an audit →
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
                className="bg-slate-900/40 border border-slate-900 hover:border-indigo-500/40 hover:bg-slate-900/70 p-5 rounded-2xl transition flex items-center justify-between group text-left w-full"
              >
                <div className="space-y-1.5 truncate pr-4 flex-1">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                    <span className="text-indigo-400/70">#{item.id}</span>
                    <span>·</span>
                    <span>{item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}</span>
                  </div>
                  <p className="font-semibold text-sm text-slate-200 truncate font-mono group-hover:text-white transition">
                    {item.url}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <ScoreBadge score={item.seo_score} />
                  <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 transition" />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-700">
        © 2026 EIGHT25MEDIA Enterprise Website Audit Tool
      </footer>
    </div>
  );
}
