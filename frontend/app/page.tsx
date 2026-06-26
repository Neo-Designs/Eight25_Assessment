'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Search, FileText, CheckCircle2, AlertCircle, ExternalLink, 
  Image as ImageIcon, Heading, ChevronRight, Cpu, Database, Eye, 
  Activity, ArrowRight, ShieldCheck, HelpCircle, Loader2, RefreshCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Define TS Interfaces matching FastAPI models
interface GroundingSource {
  metric_name: string;
  metric_value: string;
}

interface AuditFinding {
  category: string;
  observation: string;
  impact: string;
  grounding: GroundingSource[];
}

interface ActionableRecommendation {
  priority: number;
  title: string;
  details: string;
  expected_outcome: string;
  confidence_score: number;
  grounding: GroundingSource[];
}

interface AIAuditOutput {
  overall_seo_health_score: number;
  summary: string;
  findings: AuditFinding[];
  recommendations: ActionableRecommendation[];
}

interface ScrapedPageData {
  url: string;
  meta_title: string | null;
  meta_description: string | null;
  word_count: number;
  cta_count: number;
  headings: {
    h1_count: number;
    h2_count: number;
    h3_count: number;
    headings_list: Array<{ tag: string; text: string }>;
  };
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

interface AuditResponse {
  scraped_data: ScrapedPageData;
  audit_output: AIAuditOutput;
  log_id: number;
}

interface PromptLog {
  id: number;
  timestamp: string;
  url: string;
  system_prompt: string;
  user_prompt: string;
  response_content: any;
  seo_score: number | null;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<AuditResponse | null>(null);
  
  // Debug mode & Prompt Logs states
  const [showDebug, setShowDebug] = useState(false);
  const [promptLogs, setPromptLogs] = useState<PromptLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [apiHealth, setApiHealth] = useState<{status: string, provider: string, model: string} | null>(null);

  // Fetch API Health on load
  useEffect(() => {
    fetch('http://localhost:8000/api/health')
      .then(res => res.json())
      .then(data => setApiHealth(data))
      .catch(() => setApiHealth({status: 'offline', provider: 'unknown', model: 'unknown'}));
  }, []);

  // Fetch prompt logs when debug view is active or toggled
  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('http://localhost:8000/api/logs');
      if (res.ok) {
        const data = await res.json();
        setPromptLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch prompt logs", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (showDebug) {
      fetchLogs();
    }
  }, [showDebug]);

  const handleAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (!res.ok) {
        const errDetail = await res.json();
        throw new Error(errDetail.detail || "Server error occurred during audit");
      }
      
      const data: AuditResponse = await res.json();
      setAuditData(data);
      
      // Refresh logs if debug is open
      if (showDebug) {
        fetchLogs();
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to backend service");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10';
    if (score >= 60) return 'text-amber-500 border-amber-500/20 bg-amber-500/10';
    return 'text-rose-500 border-rose-500/20 bg-rose-500/10';
  };

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">Critical (P1)</span>;
      case 2:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">High (P2)</span>;
      case 3:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Medium (P3)</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">Low (P4-P5)</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-indigo-600/30 shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                EIGHT25MEDIA
              </span>
              <span className="ml-2 text-xs font-medium text-indigo-400 uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-900">
                Audit Engine
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* API Health indicator */}
            <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
              <span className={`h-2.5 w-2.5 rounded-full ${apiHealth?.status === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span>API Status: {apiHealth?.status || 'connecting...'}</span>
              {apiHealth?.status === 'healthy' && (
                <span className="text-slate-500 font-mono text-[10px]">({apiHealth.model})</span>
              )}
            </div>

            {/* Debug Toggle */}
            <button
              onClick={() => setShowDebug(!showDebug)}
              className={`flex items-center space-x-1 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                showDebug 
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20' 
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>Debug View</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Intro Hero with Form */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent mb-4">
            Enterprise Website Audit Tool
          </h1>
          <p className="text-slate-400 text-base sm:text-lg mb-8">
            Perform instant, single-page crawling paired with deep AI heuristics grounded in raw scraping metrics. Run via Pydantic & Instructor for absolute schema integrity.
          </p>

          <form onSubmit={handleAudit} className="relative group max-w-2xl mx-auto">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-focus-within:opacity-60"></div>
            <div className="relative flex items-center bg-slate-900 border border-slate-800 rounded-2xl p-2 pl-4">
              <Search className="h-5 w-5 text-slate-500 flex-shrink-0" />
              <input
                type="url"
                required
                placeholder="Enter full website URL to audit (https://...)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none text-slate-100 px-3 text-sm placeholder-slate-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Auditing...</span>
                  </>
                ) : (
                  <>
                    <span>Run Analysis</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center space-x-3 text-sm max-w-2xl mx-auto">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Dashboard Panels */}
        {auditData && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT COLUMN: Factual metrics, progress bars and charts */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Overall SEO Score Gauge */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-8 -mt-8" />
                <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-6">SEO Health Score</h2>
                
                <div className="flex items-center space-x-6">
                  <div className={`text-5xl font-black rounded-2xl px-6 py-5 border ${getScoreColor(auditData.audit_output.overall_seo_health_score)}`}>
                    {auditData.audit_output.overall_seo_health_score}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Score Assessment</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {auditData.audit_output.overall_seo_health_score >= 85 
                        ? 'Excellent technical and on-page alignment.' 
                        : auditData.audit_output.overall_seo_health_score >= 60 
                        ? 'Good foundation with key optimization opportunities.' 
                        : 'Critical gaps detected requiring immediate remediation.'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Core Page Metrics */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase border-b border-slate-800 pb-3 mb-2">Scraped Page Metrics</h2>

                {/* Word Count & CTA */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-500 block mb-1">Word Count</span>
                    <span className="text-xl font-bold text-white">{auditData.scraped_data.word_count}</span>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-500 block mb-1">CTA Elements</span>
                    <span className="text-xl font-bold text-white">{auditData.scraped_data.cta_count}</span>
                  </div>
                </div>

                {/* Meta Tags */}
                <div className="space-y-3 pt-2">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Meta Title Check</span>
                      {auditData.scraped_data.meta_title ? (
                        <span className="text-emerald-400 flex items-center"><CheckCircle2 className="h-3 w-3 mr-1" /> Found</span>
                      ) : (
                        <span className="text-rose-400 flex items-center"><AlertCircle className="h-3 w-3 mr-1" /> Missing</span>
                      )}
                    </div>
                    {auditData.scraped_data.meta_title && (
                      <div className="p-3 bg-slate-950 text-slate-300 text-xs rounded-lg border border-slate-800 font-mono break-all">
                        {auditData.scraped_data.meta_title}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Meta Description Check</span>
                      {auditData.scraped_data.meta_description ? (
                        <span className="text-emerald-400 flex items-center"><CheckCircle2 className="h-3 w-3 mr-1" /> Found</span>
                      ) : (
                        <span className="text-rose-400 flex items-center"><AlertCircle className="h-3 w-3 mr-1" /> Missing</span>
                      )}
                    </div>
                    {auditData.scraped_data.meta_description && (
                      <div className="p-3 bg-slate-950 text-slate-300 text-xs rounded-lg border border-slate-800 font-mono">
                        {auditData.scraped_data.meta_description}
                      </div>
                    )}
                  </div>
                </div>

                {/* Image Alt Text Coverage */}
                <div className="pt-2">
                  <div className="flex justify-between text-xs text-slate-500 mb-2">
                    <span className="flex items-center"><ImageIcon className="h-3.5 w-3.5 mr-1" /> Alt Text Coverage</span>
                    <span>{auditData.scraped_data.images.alt_text_coverage_pct}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-1000" 
                      style={{ width: `${auditData.scraped_data.images.alt_text_coverage_pct}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-slate-400 font-mono">
                    <div className="text-center bg-slate-950 py-1.5 rounded border border-slate-800/50">
                      Total: {auditData.scraped_data.images.total_images}
                    </div>
                    <div className="text-center bg-slate-950 py-1.5 rounded border border-slate-800/50 text-emerald-400">
                      With: {auditData.scraped_data.images.images_with_alt}
                    </div>
                    <div className="text-center bg-slate-950 py-1.5 rounded border border-slate-800/50 text-rose-400">
                      Without: {auditData.scraped_data.images.images_without_alt}
                    </div>
                  </div>
                </div>

                {/* Links Architecture */}
                <div className="pt-2">
                  <div className="flex justify-between text-xs text-slate-500 mb-2">
                    <span className="flex items-center"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Internal / External Ratio</span>
                    <span>Ratio: {auditData.scraped_data.links.ratio_internal_external}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-1000" 
                      style={{ 
                        width: `${auditData.scraped_data.links.total_links > 0 
                          ? (auditData.scraped_data.links.internal_links / auditData.scraped_data.links.total_links) * 100 
                          : 100}%` 
                      }}
                    />
                    <div 
                      className="h-full bg-indigo-900 transition-all duration-1000" 
                      style={{ 
                        width: `${auditData.scraped_data.links.total_links > 0 
                          ? (auditData.scraped_data.links.external_links / auditData.scraped_data.links.total_links) * 100 
                          : 0}%` 
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-slate-400 font-mono">
                    <div className="text-center bg-slate-950 py-1.5 rounded border border-slate-800/50">
                      Internal: {auditData.scraped_data.links.internal_links}
                    </div>
                    <div className="text-center bg-slate-950 py-1.5 rounded border border-slate-800/50">
                      External: {auditData.scraped_data.links.external_links}
                    </div>
                  </div>
                </div>

                {/* Headings structure */}
                <div className="pt-2">
                  <span className="flex items-center text-xs text-slate-500 mb-2"><Heading className="h-3.5 w-3.5 mr-1" /> Heading Hierarchy</span>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold font-mono">
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">H1</span>
                      <span className={auditData.scraped_data.headings.h1_count === 1 ? 'text-emerald-400' : 'text-amber-400'}>
                        {auditData.scraped_data.headings.h1_count}
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">H2</span>
                      <span>{auditData.scraped_data.headings.h2_count}</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">H3</span>
                      <span>{auditData.scraped_data.headings.h3_count}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Headings Raw Text View */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase border-b border-slate-800 pb-3 mb-4">Heading Sequence</h2>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2 font-mono scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-800">
                  {auditData.scraped_data.headings.headings_list.length > 0 ? (
                    auditData.scraped_data.headings.headings_list.map((h, i) => (
                      <div key={i} className="flex items-start space-x-2 text-xs py-1.5 border-b border-slate-800/40 last:border-0">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          h.tag === 'h1' ? 'bg-indigo-950 text-indigo-400 border border-indigo-900' : 'bg-slate-950 text-slate-400'
                        }`}>
                          {h.tag.toUpperCase()}
                        </span>
                        <span className="text-slate-300 line-clamp-2">{h.text}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">No headings detected on the page.</span>
                  )}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Markdown-rendered AI insights and actionable recommendations */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Executive Summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl -mr-12 -mt-12" />
                <div className="flex items-center space-x-2 text-indigo-400 mb-3">
                  <ShieldCheck className="h-5 w-5" />
                  <h2 className="text-sm font-semibold tracking-wider uppercase">Executive SEO Summary</h2>
                </div>
                <div className="text-slate-300 text-sm leading-relaxed prose prose-invert max-w-none">
                  <ReactMarkdown>{auditData.audit_output.summary}</ReactMarkdown>
                </div>
              </div>

              {/* Actionable Recommendations */}
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center space-x-2 px-2">
                  <span>Prioritized Recommendations</span>
                  <span className="text-xs font-normal text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
                    Pass 2 Analysis
                  </span>
                </h2>
                
                {auditData.audit_output.recommendations.map((rec, index) => (
                  <div 
                    key={index}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700/75 transition"
                  >
                    {/* Header info */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div className="flex items-center space-x-3">
                        {getPriorityBadge(rec.priority)}
                        <h3 className="font-bold text-white text-base">{rec.title}</h3>
                      </div>
                      
                      {/* Confidence Score */}
                      <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                        <span>Confidence:</span>
                        <span className="text-indigo-400 font-bold">{rec.confidence_score.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Details Markdown */}
                    <div className="text-slate-300 text-sm leading-relaxed prose prose-invert max-w-none">
                      <ReactMarkdown>{rec.details}</ReactMarkdown>
                    </div>

                    {/* Outcome */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Expected Outcome</span>
                      <p className="text-xs text-slate-300">{rec.expected_outcome}</p>
                    </div>

                    {/* Factual Grounding References */}
                    {rec.grounding && rec.grounding.length > 0 && (
                      <div className="flex items-center space-x-2 flex-wrap gap-2 pt-2">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Factual Grounding:</span>
                        {rec.grounding.map((g, gi) => (
                          <span 
                            key={gi}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 border border-indigo-950 text-indigo-300"
                          >
                            {g.metric_name}: <strong className="text-white ml-1">{g.metric_value}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pass 1 Findings */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-base font-bold text-white mb-4">Pass-1 Audit Findings</h2>
                <div className="space-y-4">
                  {auditData.audit_output.findings.map((f, fi) => (
                    <div key={fi} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{f.category}</span>
                        <div className="flex space-x-1.5">
                          {f.grounding.map((g, gi) => (
                            <span key={gi} className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                              {g.metric_name}={g.metric_value}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-200"><span className="font-semibold text-slate-400">Observation:</span> {f.observation}</p>
                      <p className="text-xs text-slate-400"><span className="font-semibold text-slate-500">Impact:</span> {f.impact}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* DEBUG VIEW DRAWER / BOTTOM CONTAINER */}
        {showDebug && (
          <div className="mt-12 bg-slate-900 border border-indigo-500/20 rounded-2xl overflow-hidden shadow-2xl">
            <div className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="h-5 w-5 text-indigo-400" />
                <h2 className="font-bold text-sm uppercase tracking-wider text-slate-200">System Logs & Raw JSON Audit Drawer</h2>
              </div>
              <button 
                onClick={fetchLogs} 
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 transition flex items-center space-x-1 text-xs"
                disabled={loadingLogs}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                <span>Refresh Log Entries</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 max-h-[500px] overflow-y-auto">
              
              {/* Left Panel: Raw response JSON of current audit */}
              <div className="p-6 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Audit Raw JSON Payload</h3>
                {auditData ? (
                  <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[10px] text-indigo-300 overflow-x-auto max-h-[380px]">
                    {JSON.stringify(auditData, null, 2)}
                  </pre>
                ) : (
                  <div className="text-xs text-slate-500 py-12 text-center">
                    No active audit data available. Run an audit to inspect the raw API response.
                  </div>
                )}
              </div>

              {/* Right Panel: Prompt and response logs stored in SQLite DB */}
              <div className="p-6 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                  <span>SQLite Prompt Logs (Database auditability)</span>
                  <span className="text-[10px] text-indigo-400 font-normal uppercase tracking-normal">Ready for MongoDB/Supabase</span>
                </h3>

                <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-800">
                  {loadingLogs ? (
                    <div className="flex items-center justify-center py-12 text-xs text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading SQLite records...
                    </div>
                  ) : promptLogs.length > 0 ? (
                    promptLogs.map((log) => (
                      <div key={log.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 text-[11px]">
                        <div className="flex justify-between items-center text-slate-400 border-b border-slate-800/80 pb-2">
                          <span className="font-mono text-indigo-400">Log #{log.id}</span>
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="font-semibold text-slate-500 font-mono block">AUDIT URL:</span>
                          <span className="text-slate-300 font-mono break-all">{log.url}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="font-semibold text-slate-500 font-mono block">SYSTEM PROMPT:</span>
                          <div className="p-2.5 bg-slate-900 rounded border border-slate-800/40 text-slate-400 line-clamp-3 overflow-hidden font-mono text-[10px]">
                            {log.system_prompt}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="font-semibold text-slate-500 font-mono block">USER PROMPT (Metric payloads):</span>
                          <div className="p-2.5 bg-slate-900 rounded border border-slate-800/40 text-slate-400 line-clamp-4 overflow-hidden font-mono text-[10px]">
                            {log.user_prompt}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="font-semibold text-slate-500 font-mono block">LLM STRUCTURED JSON RESPONSE:</span>
                          <pre className="p-2.5 bg-slate-900 rounded border border-slate-800/40 text-indigo-400/90 overflow-x-auto text-[9px] max-h-24">
                            {JSON.stringify(log.response_content, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 py-12 text-center">
                      No records logged in the database yet. Run audits to generate logs.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-xs text-slate-600">
        <p>© 2026 EIGHT25MEDIA Professional Website Audit Tool. Designed for AWS App Runner deployment.</p>
      </footer>
    </div>
  );
}
