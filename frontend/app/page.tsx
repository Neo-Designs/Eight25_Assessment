'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Search, ArrowRight, Sliders, CheckCircle2, ShieldCheck, Database, LayoutGrid, GitCompare, Clock } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  
  // Custom Slider weights
  const [seoWeight, setSeoWeight] = useState(40);
  const [perfWeight, setPerfWeight] = useState(30);
  const [accessWeight, setAccessWeight] = useState(20);
  const [linksWeight, setLinksWeight] = useState(10);
  const [showSliders, setShowSliders] = useState(false);

  // Normalize weights to sum up to 100
  const total = seoWeight + perfWeight + accessWeight + linksWeight;

  const handleAuditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    // Pass config values via query params
    const query = new URLSearchParams({
      url,
      seo: seoWeight.toString(),
      perf: perfWeight.toString(),
      access: accessWeight.toString(),
      links: linksWeight.toString(),
    }).toString();

    router.push(`/audit?${query}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white flex flex-col justify-between overflow-hidden relative">
      {/* Background radial glowing effects */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-indigo-600/30 shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
              EIGHT25MEDIA
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => router.push('/history')}
              className="flex items-center space-x-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl transition"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Audit History</span>
            </button>
            <button
              onClick={() => router.push('/drift')}
              className="flex items-center space-x-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl transition"
            >
              <GitCompare className="h-3.5 w-3.5" />
              <span>Drift Compare</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex-1 flex flex-col justify-center items-center relative z-10">
        
        {/* Animated Headline */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center space-x-2 bg-indigo-950 border border-indigo-900 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider text-indigo-400 uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Next-Gen Enterprise Auditor</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent leading-[1.1]">
            Inspect Your Conversion & SEO Funnel in Seconds
          </h1>
          <p className="max-w-2xl mx-auto text-slate-400 text-base sm:text-lg">
            A single-page crawler utilizing Playwright and Instructor-validated Pydantic models. Customize audit category priorities and get grounded strategic recommendations instantly.
          </p>
        </motion.div>

        {/* Input Form with Sliders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full max-w-2xl mt-12 bg-slate-900/60 border border-slate-800 backdrop-blur-xl p-6 rounded-3xl shadow-2xl relative"
        >
          <form onSubmit={handleAuditSubmit} className="space-y-6">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition group-focus-within:opacity-50"></div>
              <div className="relative flex items-center bg-slate-950 border border-slate-850 rounded-2xl p-2.5 pl-4">
                <Search className="h-5 w-5 text-slate-500 flex-shrink-0" />
                <input
                  type="url"
                  required
                  placeholder="Enter page URL to audit (https://...)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none text-slate-100 px-3 text-sm placeholder-slate-500"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm px-6 py-3.5 rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center space-x-2 flex-shrink-0"
                >
                  <span>Analyze</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Custom Weight Sliders Toggle */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowSliders(!showSliders)}
                className="flex items-center space-x-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
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
                    className="overflow-hidden space-y-4 pt-4 mt-4 border-t border-slate-800"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {/* SEO */}
                      <div className="space-y-2">
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-400">SEO Score Weight</span>
                          <span className="text-indigo-400">{Math.round((seoWeight / total) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={seoWeight}
                          onChange={(e) => setSeoWeight(Number(e.target.value))}
                          className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      {/* Performance */}
                      <div className="space-y-2">
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-400">Performance & CTA Weight</span>
                          <span className="text-indigo-400">{Math.round((perfWeight / total) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={perfWeight}
                          onChange={(e) => setPerfWeight(Number(e.target.value))}
                          className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      {/* Accessibility */}
                      <div className="space-y-2">
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-400">Accessibility Weight</span>
                          <span className="text-indigo-400">{Math.round((accessWeight / total) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={accessWeight}
                          onChange={(e) => setAccessWeight(Number(e.target.value))}
                          className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      {/* Links */}
                      <div className="space-y-2">
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-400">Link Architecture Weight</span>
                          <span className="text-indigo-400">{Math.round((linksWeight / total) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={linksWeight}
                          onChange={(e) => setLinksWeight(Number(e.target.value))}
                          className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>
        </motion.div>

        {/* Feature quick details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 max-w-3xl w-full">
          <div className="bg-slate-900/30 p-5 rounded-2xl border border-slate-900 text-center space-y-2">
            <ShieldCheck className="h-6 w-6 text-indigo-400 mx-auto" />
            <h3 className="font-bold text-sm text-slate-200">Grounded Logic</h3>
            <p className="text-xs text-slate-400">All analysis claims are grounded in raw scraped metrics.</p>
          </div>
          <div className="bg-slate-900/30 p-5 rounded-2xl border border-slate-900 text-center space-y-2">
            <Sliders className="h-6 w-6 text-indigo-400 mx-auto" />
            <h3 className="font-bold text-sm text-slate-200">Dynamic Weighting</h3>
            <p className="text-xs text-slate-400">Tweak optimization priorities using custom sliders.</p>
          </div>
          <div className="bg-slate-900/30 p-5 rounded-2xl border border-slate-900 text-center space-y-2">
            <Database className="h-6 w-6 text-indigo-400 mx-auto" />
            <h3 className="font-bold text-sm text-slate-200">Audit Insight</h3>
            <p className="text-xs text-slate-400">Full auditability with persistent DB prompt logs.</p>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-xs text-slate-600">
        <p>© 2026 EIGHT25MEDIA Professional Website Audit Tool. Designed for AWS App Runner deployment.</p>
      </footer>
    </div>
  );
}
