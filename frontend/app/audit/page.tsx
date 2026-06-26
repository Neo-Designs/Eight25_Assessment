'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ShieldAlert, Sparkles, Check } from 'lucide-react';

const STAGES = [
  { label: 'Initializing Page Scraper', desc: 'Booting headless Chromium context' },
  { label: 'Analyzing DOM Structure', desc: 'Extracting word count, CTA buttons, headings, and image alts' },
  { label: 'Validating Data Integrity', desc: 'Coercing scraped inputs against Pydantic schema model' },
  { label: 'Generating Structured Insights', desc: 'Running Instructor AI pass-1 and pass-2 recommendations' }
];

export default function AuditLoadingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeStage, setActiveStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = searchParams.get('url');
    if (!url) {
      router.push('/');
      return;
    }

    // Extract weights
    const seo = Number(searchParams.get('seo') || 40);
    const perf = Number(searchParams.get('perf') || 30);
    const access = Number(searchParams.get('access') || 20);
    const links = Number(searchParams.get('links') || 10);
    const total = seo + perf + access + links;

    const weights = {
      seo: seo / total,
      performance: perf / total,
      accessibility: access / total,
      links: links / total
    };

    // Cycle through stages visually for a smoother UX
    const stageTimer = setInterval(() => {
      setActiveStage((prev) => {
        if (prev < STAGES.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 2000);

    const runAudit = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, weights })
        });

        if (!res.ok) {
          const detail = await res.json();
          throw new Error(detail.detail || 'Audit processing failed');
        }

        const data = await res.json();
        // Save output to sessionStorage so the detail page can load it instantly
        sessionStorage.setItem(`audit-${data.log_id}`, JSON.stringify(data));
        
        // Wait slightly for visual completion
        setTimeout(() => {
          router.push(`/detail/${data.log_id}`);
        }, 1500);

      } catch (err: any) {
        setError(err.message || 'Failed to connect to audit server.');
      }
    };

    runAudit();

    return () => {
      clearInterval(stageTimer);
    };
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/20 p-8 rounded-3xl text-center space-y-4 shadow-2xl">
          <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto" />
          <h1 className="text-xl font-bold text-slate-100">Analysis Failed</h1>
          <p className="text-slate-400 text-sm">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-xl transition text-sm"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 overflow-hidden relative">
      <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      <div className="max-w-lg w-full text-center space-y-8 relative z-10">
        <div className="space-y-3">
          <div className="h-12 w-12 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-indigo-150 to-indigo-300 bg-clip-text text-transparent">
            Analyzing Webpage
          </h1>
          <p className="text-xs text-slate-500 font-mono break-all">{searchParams.get('url')}</p>
        </div>

        {/* Dynamic Status Progress Stages */}
        <div className="bg-slate-900/60 border border-slate-900 rounded-3xl p-6 text-left space-y-4">
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < activeStage;
            const isActive = idx === activeStage;

            return (
              <div 
                key={idx} 
                className={`flex items-start space-x-4 p-3 rounded-xl transition ${
                  isActive ? 'bg-slate-900 border border-slate-800/80 shadow-sm' : 'opacity-40'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {isCompleted ? (
                    <div className="h-5 w-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                      <Check className="h-3 w-3" />
                    </div>
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
                  ) : (
                    <div className="h-5 w-5 bg-slate-950 border border-slate-800 text-slate-500 rounded-full flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                    {stage.label}
                  </h3>
                  {isActive && (
                    <p className="text-xs text-slate-400 mt-1">{stage.desc}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Glowing Bar */}
        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-850">
          <motion.div 
            initial={{ width: '0%' }}
            animate={{ width: `${((activeStage + 1) / STAGES.length) * 100}%` }}
            transition={{ duration: 1.5 }}
            className="h-full bg-indigo-600 rounded-full shadow-lg shadow-indigo-600/50"
          />
        </div>
      </div>
    </div>
  );
}
