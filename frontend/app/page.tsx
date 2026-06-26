'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Search, ArrowRight, Sliders,
  ShieldCheck, Database, GitCompare, Clock,
} from 'lucide-react';

import Footer from '@/components/Footer';

/* ─────────────────────────────────────────────────────────────
   Spiderweb SVG — client-only to avoid SSR/hydration mismatch.
   ───────────────────────────────────────────────────────────── */
function SpiderwebBackground() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const cx = 600;
  const cy = 500;
  const rings = [80, 160, 240, 320, 400, 480];
  const spokes = 12;
  const angleStep = 360 / spokes;

  const spokeLines = Array.from({ length: spokes }, (_, i) => {
    const rad = (i * angleStep * Math.PI) / 180;
    const x2 = cx + Math.cos(rad) * rings[rings.length - 1];
    const y2 = cy + Math.sin(rad) * rings[rings.length - 1];
    return <line key={`spoke-${i}`} x1={cx} y1={cy} x2={x2} y2={y2} />;
  });

  const ringPolygons = rings.map((r, ri) => {
    const points = Array.from({ length: spokes }, (_, i) => {
      const rad = (i * angleStep * Math.PI) / 180;
      return `${cx + Math.cos(rad) * r},${cy + Math.sin(rad) * r}`;
    }).join(' ');
    return <polygon key={`ring-${ri}`} points={points} fill="none" />;
  });

  const threads = [
    `M${cx - 200},${cy + 50} Q${cx},${cy - 80} ${cx + 180},${cy + 70}`,
    `M${cx - 160},${cy - 120} Q${cx + 60},${cy} ${cx + 200},${cy - 100}`,
    `M${cx - 80},${cy + 200} Q${cx + 100},${cy + 80} ${cx + 80},${cy - 200}`,
  ];

  return (
    <div
      className="spiderweb-bg fixed inset-0 z-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 1000"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        style={{ opacity: 0.055 }}
      >
        <g stroke="currentColor" strokeWidth="0.8" className="text-primary">
          {spokeLines}
          {ringPolygons}
          {threads.map((d, i) => (
            <path key={`thread-${i}`} d={d} fill="none" strokeWidth="0.5" />
          ))}
        </g>
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Feature Card
   ───────────────────────────────────────────────────────────── */
function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="
      bg-light-surface dark:bg-dark-surface backdrop-blur-sm p-5 rounded-2xl
      border border-border text-center space-y-2
      hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200
    ">
      <div className="flex justify-center text-primary">{icon}</div>
      <h3 className="font-bold text-sm text-light-text dark:text-dark-text">{title}</h3>
      <p className="text-xs text-secondary leading-relaxed">{desc}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Landing Page
   ───────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');

  // Custom slider weights
  const [seoWeight, setSeoWeight]     = useState(40);
  const [perfWeight, setPerfWeight]   = useState(30);
  const [accessWeight, setAccessWeight] = useState(20);
  const [linksWeight, setLinksWeight] = useState(10);
  const [showSliders, setShowSliders] = useState(false);

  const total = seoWeight + perfWeight + accessWeight + linksWeight;

  const handleAuditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    const query = new URLSearchParams({
      url,
      seo:    seoWeight.toString(),
      perf:   perfWeight.toString(),
      access: accessWeight.toString(),
      links:  linksWeight.toString(),
    }).toString();
    router.push(`/audit?${query}`);
  };

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text flex flex-col justify-between overflow-hidden relative selection:bg-primary selection:text-white">

      {/* ── Animated spiderweb layer ─────────────────────── */}
      <SpiderwebBackground />

      {/* ── Subtle radial glow blobs (theme-aware) ───────── */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl translate-y-1/2 pointer-events-none" />

      {/* ── Header ───────────────────────────────────────── */}
      <header className="border-b border-border bg-light-bg/80 dark:bg-dark-bg/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="bg-primary p-2 rounded-lg text-white shadow-md shadow-primary/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-light-text dark:text-dark-text block leading-none">
                WebCrawler
              </span>
              <span className="text-[10px] text-secondary tracking-widest uppercase">EIGHT25MEDIA</span>
            </div>
          </div>

          {/* Nav buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => router.push('/history')}
              className="flex items-center space-x-2 text-xs font-semibold text-secondary hover:text-light-text dark:hover:text-dark-text bg-light-surface dark:bg-dark-surface border border-border hover:border-primary/40 px-3 py-2 rounded-xl transition"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Audit History</span>
            </button>
            <button
              onClick={() => router.push('/drift')}
              className="flex items-center space-x-2 text-xs font-semibold text-secondary hover:text-light-text dark:hover:text-dark-text bg-light-surface dark:bg-dark-surface border border-border hover:border-primary/40 px-3 py-2 rounded-xl transition"
            >
              <GitCompare className="h-3.5 w-3.5" />
              <span>Drift Compare</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex-1 flex flex-col justify-center items-center relative z-10">

        {/* Headline block */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center space-y-5 mb-12"
        >
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 bg-primary/10 border border-primary/25 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider text-primary uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Audit your website in Seconds</span>
          </div>

          {/* H1 */}
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-light-text dark:text-dark-text leading-[1.08]">
            Stop Guessing.{' '}
            <span className="text-primary">Start Optimising.</span>
          </h1>

          {/* H2 sub-headline */}
          <h2 className="text-lg sm:text-xl font-medium text-secondary">
            AI-powered SEO & Conversion Intelligence
          </h2>

          {/* Paragraph */}
          <p className="max-w-2xl mx-auto text-secondary text-base sm:text-[15px] leading-relaxed">
            Manual site audits are slow, outdated, and prone to human error. Get an automated,
            deep-dive analysis of your SEO and conversion performance instantly. Receive clear,
            actionable strategies customized to your business goals.
          </p>
        </motion.div>

        {/* ── Input Form ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18 }}
          className="w-full max-w-2xl bg-light-surface dark:bg-dark-surface backdrop-blur-xl border border-border p-6 rounded-3xl shadow-2xl shadow-primary/5 relative"
        >
          <form onSubmit={handleAuditSubmit} className="space-y-5">

            {/* URL Input row */}
            <div className="relative group">
              {/* Glow ring on focus */}
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary to-accent blur opacity-0 group-focus-within:opacity-20 transition-opacity duration-300" />
              <div className="relative flex items-center bg-light-bg dark:bg-dark-bg border border-border rounded-2xl p-2.5 pl-4">
                <Search className="h-5 w-5 text-secondary flex-shrink-0" />
                <input
                  id="audit-url-input"
                  type="url"
                  required
                  placeholder="Enter page URL to audit (https://...)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="
                    w-full bg-transparent border-0 focus:ring-0 focus:outline-none
                    text-light-text dark:text-dark-text px-3 text-sm
                    placeholder:text-secondary/50
                  "
                />
                <button
                  type="submit"
                  className="
                    bg-primary hover:bg-primary-hover text-white
                    font-medium text-sm px-6 py-3 rounded-xl
                    transition-colors duration-200 flex items-center space-x-2 flex-shrink-0
                    shadow-lg shadow-primary/25
                  "
                >
                  <span>Analyze</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Custom Weight Sliders Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowSliders(!showSliders)}
                className="flex items-center space-x-2 text-xs font-semibold text-secondary hover:text-primary transition-colors"
              >
                <Sliders className="h-4 w-4" />
                <span>{showSliders ? 'Hide custom weight proportions' : 'Customize audit weight proportions'}</span>
              </button>

              <AnimatePresence>
                {showSliders && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden pt-4 mt-4 border-t border-border"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                      {/* SEO */}
                      <div className="space-y-2">
                        <div className="flex justify-between font-mono">
                          <span className="text-secondary">SEO Score Weight</span>
                          <span className="text-primary font-semibold">{Math.round((seoWeight / total) * 100)}%</span>
                        </div>
                        <input type="range" min="1" max="100" value={seoWeight}
                          onChange={(e) => setSeoWeight(Number(e.target.value))}
                          className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      {/* Performance */}
                      <div className="space-y-2">
                        <div className="flex justify-between font-mono">
                          <span className="text-secondary">Performance & CTA Weight</span>
                          <span className="text-primary font-semibold">{Math.round((perfWeight / total) * 100)}%</span>
                        </div>
                        <input type="range" min="1" max="100" value={perfWeight}
                          onChange={(e) => setPerfWeight(Number(e.target.value))}
                          className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      {/* Accessibility */}
                      <div className="space-y-2">
                        <div className="flex justify-between font-mono">
                          <span className="text-secondary">Accessibility Weight</span>
                          <span className="text-primary font-semibold">{Math.round((accessWeight / total) * 100)}%</span>
                        </div>
                        <input type="range" min="1" max="100" value={accessWeight}
                          onChange={(e) => setAccessWeight(Number(e.target.value))}
                          className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      {/* Links */}
                      <div className="space-y-2">
                        <div className="flex justify-between font-mono">
                          <span className="text-secondary">Link Architecture Weight</span>
                          <span className="text-primary font-semibold">{Math.round((linksWeight / total) * 100)}%</span>
                        </div>
                        <input type="range" min="1" max="100" value={linksWeight}
                          onChange={(e) => setLinksWeight(Number(e.target.value))}
                          className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>
        </motion.div>

        {/* ── Feature Cards ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.36 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-14 max-w-3xl w-full"
        >
          <FeatureCard
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Grounded Logic"
            desc="All analysis claims are grounded in raw scraped metrics — no hallucinations."
          />
          <FeatureCard
            icon={<Sliders className="h-6 w-6" />}
            title="Dynamic Weighting"
            desc="Tweak optimization priorities using custom audit weight sliders."
          />
          <FeatureCard
            icon={<Database className="h-6 w-6" />}
            title="Audit Insight"
            desc="Full auditability with persistent DB prompt logs and drift tracking."
          />
        </motion.div>
      </main>

      {/* ── Footer ───────────────────────────────────────── */}
      <Footer />
    </div>
  );
}
