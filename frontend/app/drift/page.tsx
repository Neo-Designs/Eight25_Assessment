'use client';

import React, { useState } from 'react';
import {
  BarChart3, Target, Loader2, WifiOff, GitCompare,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

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
  const color = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-secondary';
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
    <tr className="hover:bg-light-bg/50 dark:hover:bg-dark-bg/50 transition-colors">
      <td className="p-4 font-semibold text-light-text dark:text-dark-text text-sm">{label}</td>
      <td className="p-4 text-secondary font-mono text-sm">{primary}</td>
      <td className="p-4 text-secondary font-mono text-sm">{competitor}</td>
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
      const data = await apiFetch<{
        primary_data: ScrapedPageData;
        competitor_data: ScrapedPageData;
      }>('/api/drift', {
        method: 'POST',
        body: JSON.stringify({ url: primaryUrl, competitor_url: competitorUrl }),
        signal: AbortSignal.timeout(60_000),
      });
      setDriftResult({ primary: data.primary_data, competitor: data.competitor_data });
      setDriftState('success');
    } catch (err: unknown) {
      setDriftError(err instanceof Error ? err.message : 'Drift comparison failed — check both URLs and the backend.');
      setDriftState('error');
    }
  };

  const hostname = (url: string) => {
    try { return new URL(url).hostname; } catch { return url; }
  };

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text selection:bg-primary selection:text-white pb-16">

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="border-b border-border bg-light-bg/80 dark:bg-dark-bg/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center">
            <GitCompare className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-bold text-sm text-light-text dark:text-dark-text block leading-none">Drift Comparison</span>
            <span className="text-[10px] text-secondary font-mono">Scrape two pages and compare metrics side-by-side</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">

        {/* ── Input form ────────────────────────────────────── */}
        <section className="bg-light-surface dark:bg-dark-surface border border-border rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-light-text dark:text-dark-text">Competitive SEO Drift Analysis</h1>
              <p className="text-xs text-secondary mt-0.5">Enter two URLs to compare all key SEO metrics side-by-side</p>
            </div>
          </div>

          <form onSubmit={handleDriftCompare} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5 space-y-2">
              <label className="text-xs font-semibold text-secondary block">Your Website</label>
              <input
                type="url"
                required
                placeholder="https://mywebsite.com"
                value={primaryUrl}
                onChange={(e) => setPrimaryUrl(e.target.value)}
                className="w-full bg-light-bg dark:bg-dark-bg border border-border rounded-xl px-4 py-3 text-sm text-light-text dark:text-dark-text focus:outline-none focus:border-primary font-mono placeholder:text-secondary/40 transition"
              />
            </div>
            <div className="md:col-span-5 space-y-2">
              <label className="text-xs font-semibold text-secondary block">Competitor Website</label>
              <input
                type="url"
                required
                placeholder="https://competitor.com"
                value={competitorUrl}
                onChange={(e) => setCompetitorUrl(e.target.value)}
                className="w-full bg-light-bg dark:bg-dark-bg border border-border rounded-xl px-4 py-3 text-sm text-light-text dark:text-dark-text focus:outline-none focus:border-primary font-mono placeholder:text-secondary/40 transition"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={driftState === 'loading'}
                className="w-full bg-primary hover:bg-primary-hover text-white font-semibold text-sm py-3 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
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
          <div className="flex flex-col items-center justify-center py-20 text-secondary gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Scraping both pages simultaneously…</p>
          </div>
        )}

        {/* ── Results table ─────────────────────────────────── */}
        {driftResult && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-light-text dark:text-dark-text">Comparison Results</h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary font-mono">
                  {hostname(driftResult.primary.url)}
                </span>
                <span className="text-secondary">vs</span>
                <span className="px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-accent font-mono">
                  {hostname(driftResult.competitor.url)}
                </span>
              </div>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-light-surface dark:bg-dark-surface">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-light-bg dark:bg-dark-bg border-b border-border text-secondary">
                    <th className="p-4 font-semibold text-xs uppercase tracking-wider">Metric</th>
                    <th className="p-4 font-semibold text-xs text-primary truncate">
                      {hostname(driftResult.primary.url)}
                    </th>
                    <th className="p-4 font-semibold text-xs text-accent truncate">
                      {hostname(driftResult.competitor.url)}
                    </th>
                    <th className="p-4 font-semibold text-xs text-center">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
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
                      <span className="text-secondary font-semibold">
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
                      <span className="text-secondary font-bold">
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
                <div key={insight.label} className="bg-light-surface dark:bg-dark-surface border border-border rounded-2xl p-4 space-y-1">
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wider">{insight.label}</p>
                  <p className={`text-sm font-bold ${insight.winner === 'primary' ? 'text-primary' : 'text-accent'}`}>
                    {insight.winner === 'primary' ? `✓ ${hostname(driftResult.primary.url)}` : `✓ ${hostname(driftResult.competitor.url)}`}
                  </p>
                  <p className="text-xs text-secondary">{insight.detail}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Empty idle state ──────────────────────────────── */}
        {driftState === 'idle' && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-light-surface dark:bg-dark-surface border border-border flex items-center justify-center">
              <GitCompare className="h-7 w-7 text-secondary" />
            </div>
            <p className="text-sm font-semibold text-secondary">No comparison run yet</p>
            <p className="text-xs text-secondary/60 max-w-xs">Enter two URLs above and click Compare to see a detailed side-by-side breakdown of page metrics.</p>
          </div>
        )}

      </main>

      <footer className="border-t border-border bg-light-surface/70 dark:bg-dark-surface/70 py-6 text-center text-xs text-secondary">
        &copy; 2026 EIGHT25MEDIA &middot; WebCrawler — Professional SEO &amp; Conversion Audit Platform
      </footer>
    </div>
  );
}
