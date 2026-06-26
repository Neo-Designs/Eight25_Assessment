'use client';

import React, { useState } from 'react';
import {
  BarChart3, Target, Loader2, WifiOff, GitCompare,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface ScrapedPageData {
  url: string;
  meta_title: string | null;
  meta_description: string | null;
  word_count: number;
  cta_count: number;
  headings: { h1_count: number; h2_count: number; h3_count: number };
  links: {
    total_links: number;
    internal_links: number;
    external_links: number;
    ratio_internal_external: number;
  };
  images: {
    total_images: number;
    images_with_alt: number;
    images_without_alt: number;
    alt_text_coverage_pct: number;
  };
}

type FetchState = 'idle' | 'loading' | 'error' | 'success';

function DriftVariance({ primary, competitor }: { primary: number; competitor: number }) {
  const delta = primary - competitor;
  const sign = delta > 0 ? '+' : '';
  const color = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-slate-400';
  return <span className={`font-bold font-mono ${color}`}>{sign}{delta}</span>;
}

function MetricRow({
  label,
  primary,
  competitor,
  variance,
}: {
  label: string;
  primary: React.ReactNode;
  competitor: React.ReactNode;
  variance: React.ReactNode;
}) {
  return (
    <tr className="hover:bg-slate-900/40 transition-colors">
      <td className="p-4 font-semibold text-slate-200 text-sm">{label}</td>
      <td className="p-4 text-slate-300 font-mono text-sm">{primary}</td>
      <td className="p-4 text-slate-300 font-mono text-sm">{competitor}</td>
      <td className="p-4 text-center font-mono text-sm">{variance}</td>
    </tr>
  );
}

export default function DriftPage() {
  const [primaryUrl, setPrimaryUrl] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [driftState, setDriftState] = useState<FetchState>('idle');
  const [driftError, setDriftError] = useState<string | null>(null);
  const [driftResult, setDriftResult] = useState<{
    primary: ScrapedPageData;
    competitor: ScrapedPageData;
  } | null>(null);

  const handleDriftCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryUrl || !competitorUrl) return;

    setDriftState('loading');
    setDriftError(null);
    setDriftResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/drift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: primaryUrl, competitor_url: competitorUrl }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Server error ${res.status}`);
      }

      const data = await res.json();
      setDriftResult({ primary: data.primary_data, competitor: data.competitor_data });
      setDriftState('success');
    } catch (err: any) {
      setDriftError(err.message ?? 'Drift comparison failed — check both URLs and the backend.');
      setDriftState('error');
    }
  };

  const hostname = (url: string) => {
    try { return new URL(url).hostname; } catch { return url; }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white pb-16">

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <GitCompare className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <span className="font-bold text-sm text-slate-200 block leading-none">Drift Comparison</span>
            <span className="text-[10px] text-slate-500 font-mono">Scrape two pages and compare metrics side-by-side</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">

        {/* ── Input form ────────────────────────────────────── */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Competitive SEO Drift Analysis</h1>
              <p className="text-xs text-slate-500 mt-0.5">Enter two URLs to compare all key SEO metrics side-by-side</p>
            </div>
          </div>

          <form onSubmit={handleDriftCompare} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5 space-y-2">
              <label className="text-xs font-semibold text-slate-400 block">Your Website</label>
              <input
                type="url"
                required
                placeholder="https://mywebsite.com"
                value={primaryUrl}
                onChange={(e) => setPrimaryUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono placeholder:text-slate-700 transition"
              />
            </div>
            <div className="md:col-span-5 space-y-2">
              <label className="text-xs font-semibold text-slate-400 block">Competitor Website</label>
              <input
                type="url"
                required
                placeholder="https://competitor.com"
                value={competitorUrl}
                onChange={(e) => setCompetitorUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono placeholder:text-slate-700 transition"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={driftState === 'loading'}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm py-3 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
              >
                {driftState === 'loading' ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /><span>Running…</span></>
                ) : (
                  <><Target className="h-4 w-4" /><span>Compare</span></>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* ── Error banner ──────────────────────────────────── */}
        {driftState === 'error' && driftError && (
          <div className="flex items-start gap-3 p-5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm">
            <WifiOff className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Drift comparison failed</p>
              <p className="text-rose-400/80 mt-1 text-xs">{driftError}</p>
            </div>
          </div>
        )}

        {/* ── Loading state ─────────────────────────────────── */}
        {driftState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm">Scraping both pages simultaneously…</p>
          </div>
        )}

        {/* ── Results table ─────────────────────────────────── */}
        {driftResult && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-white">Comparison Results</h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono">
                  {hostname(driftResult.primary.url)}
                </span>
                <span className="text-slate-600">vs</span>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 font-mono">
                  {hostname(driftResult.competitor.url)}
                </span>
              </div>
            </div>

            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                    <th className="p-4 font-semibold text-xs uppercase tracking-wider">Metric</th>
                    <th className="p-4 font-semibold text-xs text-indigo-400 truncate">
                      {hostname(driftResult.primary.url)}
                    </th>
                    <th className="p-4 font-semibold text-xs text-purple-400 truncate">
                      {hostname(driftResult.competitor.url)}
                    </th>
                    <th className="p-4 font-semibold text-xs text-center">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  <MetricRow
                    label="Word Count"
                    primary={driftResult.primary.word_count.toLocaleString()}
                    competitor={driftResult.competitor.word_count.toLocaleString()}
                    variance={<DriftVariance primary={driftResult.primary.word_count} competitor={driftResult.competitor.word_count} />}
                  />
                  <MetricRow
                    label="CTA Elements"
                    primary={driftResult.primary.cta_count}
                    competitor={driftResult.competitor.cta_count}
                    variance={<DriftVariance primary={driftResult.primary.cta_count} competitor={driftResult.competitor.cta_count} />}
                  />
                  <MetricRow
                    label="H1 Headings"
                    primary={
                      <span className={driftResult.primary.headings.h1_count === 1 ? 'text-emerald-400' : 'text-amber-400'}>
                        {driftResult.primary.headings.h1_count}
                      </span>
                    }
                    competitor={
                      <span className={driftResult.competitor.headings.h1_count === 1 ? 'text-emerald-400' : 'text-amber-400'}>
                        {driftResult.competitor.headings.h1_count}
                      </span>
                    }
                    variance={
                      <span className="text-slate-400 font-semibold">
                        {driftResult.primary.headings.h1_count === driftResult.competitor.headings.h1_count
                          ? 'Aligned'
                          : driftResult.primary.headings.h1_count === 1
                          ? '✓ Primary'
                          : '✓ Competitor'}
                      </span>
                    }
                  />
                  <MetricRow
                    label="Alt Text Coverage"
                    primary={`${driftResult.primary.images.alt_text_coverage_pct}%`}
                    competitor={`${driftResult.competitor.images.alt_text_coverage_pct}%`}
                    variance={
                      <span className={
                        driftResult.primary.images.alt_text_coverage_pct >= driftResult.competitor.images.alt_text_coverage_pct
                          ? 'text-emerald-400 font-bold'
                          : 'text-rose-400 font-bold'
                      }>
                        {(driftResult.primary.images.alt_text_coverage_pct - driftResult.competitor.images.alt_text_coverage_pct).toFixed(1)}%
                      </span>
                    }
                  />
                  <MetricRow
                    label="Internal Link Ratio"
                    primary={`${driftResult.primary.links.ratio_internal_external}x`}
                    competitor={`${driftResult.competitor.links.ratio_internal_external}x`}
                    variance={
                      <span className="text-slate-400 font-bold">
                        {(driftResult.primary.links.ratio_internal_external - driftResult.competitor.links.ratio_internal_external).toFixed(2)}
                      </span>
                    }
                  />
                  <MetricRow
                    label="Total Links"
                    primary={driftResult.primary.links.total_links}
                    competitor={driftResult.competitor.links.total_links}
                    variance={<DriftVariance primary={driftResult.primary.links.total_links} competitor={driftResult.competitor.links.total_links} />}
                  />
                  <MetricRow
                    label="Total Images"
                    primary={driftResult.primary.images.total_images}
                    competitor={driftResult.competitor.images.total_images}
                    variance={<DriftVariance primary={driftResult.primary.images.total_images} competitor={driftResult.competitor.images.total_images} />}
                  />
                </tbody>
              </table>
            </div>

            {/* Quick insight cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {[
                {
                  label: 'Content Depth',
                  winner: driftResult.primary.word_count >= driftResult.competitor.word_count ? 'primary' : 'competitor',
                  detail: `${Math.abs(driftResult.primary.word_count - driftResult.competitor.word_count).toLocaleString()} words difference`,
                },
                {
                  label: 'Image Accessibility',
                  winner: driftResult.primary.images.alt_text_coverage_pct >= driftResult.competitor.images.alt_text_coverage_pct ? 'primary' : 'competitor',
                  detail: `${Math.abs(driftResult.primary.images.alt_text_coverage_pct - driftResult.competitor.images.alt_text_coverage_pct).toFixed(1)}% coverage gap`,
                },
                {
                  label: 'CTA Presence',
                  winner: driftResult.primary.cta_count >= driftResult.competitor.cta_count ? 'primary' : 'competitor',
                  detail: `${Math.abs(driftResult.primary.cta_count - driftResult.competitor.cta_count)} CTA difference`,
                },
              ].map((insight) => (
                <div key={insight.label} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{insight.label}</p>
                  <p className={`text-sm font-bold ${insight.winner === 'primary' ? 'text-indigo-400' : 'text-purple-400'}`}>
                    {insight.winner === 'primary' ? `✓ ${hostname(driftResult.primary.url)}` : `✓ ${hostname(driftResult.competitor.url)}`}
                  </p>
                  <p className="text-xs text-slate-500">{insight.detail}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Empty idle state ──────────────────────────────── */}
        {driftState === 'idle' && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <GitCompare className="h-7 w-7 text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-400">No comparison run yet</p>
            <p className="text-xs text-slate-600 max-w-xs">Enter two URLs above and click Compare to see a detailed side-by-side breakdown of page metrics.</p>
          </div>
        )}

      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-700">
        © 2026 EIGHT25MEDIA Enterprise Website Audit Tool
      </footer>
    </div>
  );
}

