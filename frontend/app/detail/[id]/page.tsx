'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { 
  ArrowLeft, AlertCircle, ExternalLink, Image as ImageIcon, 
  ShieldCheck, MessageSquare, Send, Loader2
} from 'lucide-react';

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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function AuditDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const logId = Number(id);

  const [auditData, setAuditData] = useState<AuditResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Chatbot state
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]     = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Data fetch ────────────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Try session-storage cache first
    const cached = sessionStorage.getItem(`audit-${logId}`);
    if (cached) {
      try {
        setAuditData(JSON.parse(cached));
        setLoading(false);
        return;
      } catch (err) {
        console.error('Error parsing cached audit', err);
      }
    }

    // 2. Fallback: fetch from API
    const fetchLogFromAPI = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/audit/${logId}/results`);
        if (!res.ok) throw new Error('Failed to load audit detail log');
        setAuditData(await res.json());
      } catch (err: any) {
        setError(err.message ?? 'Failed to load audit detail.');
      } finally {
        setLoading(false);
      }
    };

    fetchLogFromAPI();
  }, [logId]);

  // ── Chat scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  // ── Chat submit ───────────────────────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: logId, message: userMsg, history: messages }),
      });
      if (!res.ok) throw new Error('Assistant response failed');
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '**System Error:** Failed to fetch reply from engine.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10';
    if (score >= 60) return 'text-amber-500 border-amber-500/20 bg-amber-500/10';
    return 'text-rose-500 border-rose-500/20 bg-rose-500/10';
  };

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1: return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">Critical (P1)</span>;
      case 2: return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">High (P2)</span>;
      case 3: return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Medium (P3)</span>;
      default: return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-secondary/10 text-secondary border border-secondary/20">Low (P4+)</span>;
    }
  };

  // ── Guard: Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex flex-col items-center justify-center p-6 text-light-text dark:text-dark-text">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
        <span className="text-xs text-secondary">Loading audit deep-dive details…</span>
      </div>
    );
  }

  // ── Guard: Error or no data ───────────────────────────────────────────────
  if (error || !auditData) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex flex-col items-center justify-center p-6 text-light-text dark:text-dark-text">
        <div className="max-w-md w-full bg-light-surface dark:bg-dark-surface border border-rose-500/20 p-8 rounded-3xl text-center space-y-4 shadow-2xl">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h1 className="text-xl font-bold text-light-text dark:text-dark-text">Log Record Error</h1>
          <p className="text-secondary text-sm">{error ?? 'Could not locate audit details'}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-primary hover:bg-primary text-white font-medium py-2 rounded-xl transition text-sm"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  // ── Safe accessors (optional chaining + fallbacks) ────────────────────────
  const score       = auditData?.audit_output?.overall_seo_health_score ?? 0;
  const summary     = auditData?.audit_output?.summary ?? '';
  const recs        = auditData?.audit_output?.recommendations ?? [];
  const url         = auditData?.scraped_data?.url ?? '—';
  const wordCount   = auditData?.scraped_data?.word_count ?? 0;
  const ctaCount    = auditData?.scraped_data?.cta_count ?? 0;
  const altPct      = auditData?.scraped_data?.images?.alt_text_coverage_pct ?? 0;
  const linkRatio   = auditData?.scraped_data?.links?.ratio_internal_external ?? 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text selection:bg-primary selection:text-white pb-16">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="border-b border-primary/15 bg-light-bg dark:bg-dark-bg/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push('/history')}
            className="flex items-center space-x-2 text-xs font-semibold text-secondary hover:text-light-text dark:text-dark-text transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dashboard Logs</span>
          </button>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-secondary font-mono">LOG #{auditData?.log_id}</span>
          </div>
        </div>
      </header>

      {/* ── Main Body ──────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* URL Banner */}
        <div className="mb-8 p-4 bg-light-surface dark:bg-dark-surface border border-primary/15 rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] text-secondary font-mono block uppercase tracking-wider">Audited Target URL</span>
            <span className="text-sm font-semibold font-mono text-light-text dark:text-dark-text break-all">{url}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ── LEFT: Metrics ──────────────────────────────────────── */}
          <div className="lg:col-span-5 space-y-6">

            {/* Score gauge */}
            <div className="bg-light-surface dark:bg-dark-surface border border-primary/15 rounded-2xl p-6 relative overflow-hidden">
              <h2 className="text-xs font-bold tracking-wider text-secondary uppercase mb-4">Overall Score</h2>
              <div className="flex items-center space-x-6">
                <div className={`text-5xl font-black rounded-2xl px-6 py-5 border ${getScoreColor(score)}`}>
                  {score}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-light-text dark:text-dark-text">Strategic Optimization Rating</h3>
                  <p className="text-xs text-secondary mt-1 leading-relaxed">
                    Calculated dynamically by analyzing keyword heading hierarchy, image alt context,
                    word count ratio, and CTA positioning indexes.
                  </p>
                </div>
              </div>
            </div>

            {/* General metrics */}
            <div className="bg-light-surface dark:bg-dark-surface border border-primary/15 rounded-2xl p-6 space-y-5">
              <h2 className="text-xs font-bold tracking-wider text-secondary uppercase border-b border-primary/10 pb-3">
                Audit Metrics Output
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-xl border border-primary/10">
                  <span className="text-[10px] text-secondary block mb-0.5">Word Count</span>
                  <span className="text-lg font-bold text-light-text dark:text-dark-text">{wordCount || '—'}</span>
                </div>
                <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-xl border border-primary/10">
                  <span className="text-[10px] text-secondary block mb-0.5">CTA Count</span>
                  <span className="text-lg font-bold text-light-text dark:text-dark-text">{ctaCount || '—'}</span>
                </div>
              </div>

              {/* Alt coverage bar */}
              <div>
                <div className="flex justify-between text-xs text-secondary mb-2">
                  <span className="flex items-center gap-1">
                    <ImageIcon className="h-3.5 w-3.5" /> Image Alt Coverage
                  </span>
                  <span className="font-mono">{altPct}%</span>
                </div>
                <div className="h-2 w-full bg-light-bg dark:bg-dark-bg rounded-full overflow-hidden border border-primary/10">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${altPct}%` }}
                  />
                </div>
              </div>

              {/* Link ratio bar */}
              <div>
                <div className="flex justify-between text-xs text-secondary mb-2">
                  <span className="flex items-center gap-1">
                    <ExternalLink className="h-3.5 w-3.5" /> Internal Links Ratio
                  </span>
                  <span className="font-mono">{linkRatio}x</span>
                </div>
                <div className="h-2 w-full bg-light-bg dark:bg-dark-bg rounded-full overflow-hidden border border-primary/10">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(linkRatio * 10, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Insights + Chat ──────────────────────────────── */}
          <div className="lg:col-span-7 space-y-6">

            {/* Executive Summary */}
            <div className="bg-light-surface dark:bg-dark-surface border border-primary/15 rounded-2xl p-6">
              <div className="flex items-center space-x-2 text-primary mb-4">
                <ShieldCheck className="h-5 w-5" />
                <h2 className="text-xs font-bold tracking-wider uppercase">Executive SEO Summary</h2>
              </div>
              <div className="text-secondary text-xs leading-relaxed prose prose-sm max-w-none">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold tracking-wider text-secondary uppercase px-1">
                Prioritized Actions
              </h2>
              {recs.map((rec, idx) => (
                <div key={idx} className="bg-light-surface dark:bg-dark-surface border border-primary/15 rounded-2xl p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/10 pb-2.5">
                    <div className="flex items-center space-x-2.5">
                      {getPriorityBadge(rec.priority)}
                      <h3 className="font-bold text-sm text-light-text dark:text-dark-text">{rec.title}</h3>
                    </div>
                    <span className="text-[10px] text-primary font-mono">
                      Conf: {rec.confidence_score?.toFixed(2) ?? '—'}
                    </span>
                  </div>
                  <div className="text-secondary text-xs leading-relaxed prose prose-sm max-w-none">
                    <ReactMarkdown>{rec.details}</ReactMarkdown>
                  </div>
                  <div className="bg-light-bg dark:bg-dark-bg p-3 rounded-lg border border-primary/10 text-[11px] text-secondary">
                    <strong className="text-primary uppercase tracking-widest text-[9px] block mb-0.5">
                      Expected Outcome
                    </strong>
                    {rec.expected_outcome}
                  </div>
                </div>
              ))}
            </div>

            {/* AI Chat */}
            <div className="bg-light-surface dark:bg-dark-surface border border-primary/15 rounded-3xl p-5 space-y-4">
              <div className="flex items-center space-x-2 text-primary border-b border-primary/10 pb-3">
                <MessageSquare className="h-5 w-5" />
                <div>
                  <h3 className="text-sm font-bold text-light-text dark:text-dark-text">AI Assistant</h3>
                  <p className="text-[10px] text-secondary">Ask questions about this audit's findings</p>
                </div>
              </div>

              {/* Message thread */}
              <div className="max-h-80 overflow-y-auto space-y-3 p-3 bg-light-bg dark:bg-dark-bg rounded-2xl border border-primary/10">
                {messages.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <MessageSquare className="h-6 w-6 text-secondary/40 mx-auto" />
                    <p className="text-secondary text-sm">Ask anything about this audit.</p>
                    <p className="text-secondary/60 text-xs">e.g. "Why is my SEO score low?" or "What should I fix first?"</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`rounded-xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-primary/10 border border-primary/25'
                        : 'bg-light-surface dark:bg-dark-surface border border-primary/10'
                    }`}>
                      <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${
                        msg.role === 'user' ? 'text-primary' : 'text-secondary'
                      }`}>
                        {msg.role === 'user' ? 'You' : 'AI Strategist'}
                      </p>
                      <div className="text-sm text-light-text dark:text-dark-text leading-relaxed prose prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-light-surface dark:bg-dark-surface border border-primary/10 rounded-xl text-secondary text-sm">
                    <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                    <span>Thinking…</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input */}
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ask a question about this audit…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="
                    w-full bg-light-bg dark:bg-dark-bg border border-primary/20 rounded-xl
                    px-4 py-3 text-sm text-light-text dark:text-dark-text
                    focus:outline-none focus:border-primary
                    placeholder:text-secondary/50
                  "
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="bg-primary hover:bg-primary p-3 rounded-xl text-white transition flex-shrink-0 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-primary/15 bg-light-surface dark:bg-dark-surface/70 py-6 text-center text-xs text-secondary">
        <p>© 2026 EIGHT25MEDIA · WebCrawler — Professional SEO &amp; Conversion Audit Platform</p>
      </footer>
    </div>
  );
}
