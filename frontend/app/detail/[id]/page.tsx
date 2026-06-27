'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { 
  ArrowLeft, AlertCircle, ExternalLink, Image as ImageIcon, 
  ShieldCheck, MessageSquare, Send, Loader2, Database, Cpu
} from 'lucide-react';
import { apiFetch } from '@shared/api';
import GroqKeyModal from '@/components/GroqKeyModal';

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
  const [showInsightLogs, setShowInsightLogs] = useState(false);
  const [dbLogDetail, setDbLogDetail] = useState<{ system_prompt: string; user_prompt: string } | null>(null);
  const [showGroqModal, setShowGroqModal] = useState(false);
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
      } catch (_err) {
        console.error('Error parsing cached audit', _err);
      }
    }

    // 2. Fallback: fetch from API
    const fetchLogFromAPI = async () => {
      try {
        const data = await apiFetch<AuditResponse>(`/api/audit/${logId}/results`);
        setAuditData(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load audit detail.');
      } finally {
        setLoading(false);
      }
    };

    fetchLogFromAPI();
  }, [logId]);

  useEffect(() => {
    if (showInsightLogs && !dbLogDetail) {
      apiFetch<{ system_prompt: string; user_prompt: string }>(`/api/audit/${logId}/logs`)
        .then(setDbLogDetail)
        .catch(() => {});
    }
  }, [showInsightLogs, dbLogDetail, logId]);

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
      const data = await apiFetch<{ response: string }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ log_id: logId, message: userMsg, history: messages }),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('GROQ_QUOTA_EXCEEDED') || msg.includes('503')) {
        setShowGroqModal(true);
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Groq API quota reached. Please update your API key using the prompt that just appeared.' }]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: '**System Error:** Failed to fetch reply from engine.' },
        ]);
      }
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
        <span className="text-xs text-secondary">Loading audit deep-dive details...</span>
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
            className="w-full bg-primary hover:bg-primary-hover text-white font-medium py-2 rounded-xl transition text-sm"
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

      <GroqKeyModal
        open={showGroqModal}
        onClose={() => setShowGroqModal(false)}
        onSuccess={() => setShowGroqModal(false)}
      />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-light-bg/80 dark:bg-dark-bg/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push('/history')}
            className="flex items-center space-x-2 text-xs font-semibold text-secondary hover:text-light-text dark:hover:text-dark-text transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dashboard Logs</span>
          </button>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-secondary font-mono">LOG #{auditData?.log_id}</span>
            <button
              onClick={() => setShowInsightLogs(!showInsightLogs)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                showInsightLogs
                  ? 'bg-primary border-primary text-white shadow shadow-primary/20'
                  : 'bg-light-surface dark:bg-dark-surface border-border text-secondary hover:border-primary/40'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>Audit Insight</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Body: 4 distinct sections ───────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* URL Banner */}
        <div className="mb-2 p-4 bg-light-surface dark:bg-dark-surface border border-border rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] text-secondary font-mono block uppercase tracking-wider">Audited Target URL</span>
            <span className="text-sm font-semibold font-mono text-light-text dark:text-dark-text break-all">{url}</span>
          </div>
        </div>

        {/* 1) FACTUAL METRICS */}
        <section className="bg-light-surface dark:bg-dark-surface border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-lg font-bold tracking-wide text-light-text dark:text-dark-text capitalize mb-6 border-b border-border pb-2">Factual Metrics</h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Metrics list */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-border bg-light-bg dark:bg-dark-bg">
                <div className="text-[10px] text-secondary mb-1">Total Word Count</div>
                <div className="text-lg font-bold">{wordCount.toLocaleString() || '—'}</div>
              </div>

              <div className="p-4 rounded-xl border border-border bg-light-bg dark:bg-dark-bg">
                <div className="text-[10px] text-secondary mb-1">Headings</div>
                <div className="flex items-center gap-4">
                  <div className="text-sm"><strong>H1:</strong> {auditData?.scraped_data?.headings?.h1_count ?? 0}</div>
                  <div className="text-sm"><strong>H2:</strong> {auditData?.scraped_data?.headings?.h2_count ?? 0}</div>
                  <div className="text-sm"><strong>H3:</strong> {auditData?.scraped_data?.headings?.h3_count ?? 0}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border bg-light-bg dark:bg-dark-bg">
                <div className="text-[10px] text-secondary mb-1">CTAs (buttons / primary action links)</div>
                <div className="text-lg font-bold">{ctaCount || '—'}</div>
              </div>

              <div className="p-4 rounded-xl border border-border bg-light-bg dark:bg-dark-bg">
                <div className="text-[10px] text-secondary mb-1">Links (internal / external)</div>
                <div className="text-sm">
                  <div><strong>Internal:</strong> {auditData?.scraped_data?.links?.internal_links ?? 0}</div>
                  <div><strong>External:</strong> {auditData?.scraped_data?.links?.external_links ?? 0}</div>
                  <div className="mt-1 text-xs text-secondary">Ratio: {auditData?.scraped_data?.links?.ratio_internal_external ?? 0}x</div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border bg-light-bg dark:bg-dark-bg">
                <div className="text-[10px] text-secondary mb-1">Images</div>
                <div className="text-sm">
                  <div><strong>Total:</strong> {auditData?.scraped_data?.images?.total_images ?? 0}</div>
                  <div><strong>With alt:</strong> {auditData?.scraped_data?.images?.images_with_alt ?? 0}</div>
                  <div><strong>Without alt:</strong> {auditData?.scraped_data?.images?.images_without_alt ?? 0}</div>
                  <div className="mt-1 text-xs text-secondary">Missing alt: {(100 - (auditData?.scraped_data?.images?.alt_text_coverage_pct ?? 100)).toFixed(1)}%</div>
                </div>
              </div>

            </div>

            {/* Meta box */}
            <div className="p-4 rounded-xl border border-border bg-light-bg dark:bg-dark-bg">
              <div className="text-[10px] text-secondary mb-2 uppercase font-mono tracking-wider">Meta Title & Description</div>
              <div className="space-y-3">
                <div className="bg-light-surface/50 dark:bg-dark-surface/50 p-3 rounded-md border border-border">
                  <div className="text-[10px] text-secondary uppercase">Title</div>
                  <div className="text-sm font-semibold mt-1">{auditData?.scraped_data?.meta_title ?? '—'}</div>
                </div>
                <div className="bg-light-surface/50 dark:bg-dark-surface/50 p-3 rounded-md border border-border">
                  <div className="text-[10px] text-secondary uppercase">Description</div>
                  <div className="text-sm mt-1 text-secondary leading-relaxed">{auditData?.scraped_data?.meta_description ?? '—'}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2) AI INSIGHTS — grouped by category */}
        <section className="bg-light-surface dark:bg-dark-surface border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-lg font-bold tracking-wide text-light-text dark:text-dark-text capitalize mb-6 border-b border-border pb-2">AI Insights</h2>

          <div className="space-y-4">
            {['SEO structure','Messaging clarity','CTA usage','Content depth','UX/structural concerns'].map((cat) => {
              const items = (auditData?.audit_output?.findings || []).filter((f: AuditFinding) => f.category === cat);
              if (!items || items.length === 0) return null;
              return (
                <div key={cat} className="p-4 border border-border rounded-2xl bg-light-bg dark:bg-dark-bg">
                  <div className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">{cat}</div>
                  <ul className="text-sm text-secondary list-disc pl-5 space-y-2">
                    {items.map((it: AuditFinding, idx: number) => (
                      <li key={idx}>
                        <div className="font-semibold text-light-text dark:text-dark-text">{it.observation}</div>
                        <div className="text-xs text-secondary mt-1">Impact: {it.impact}</div>
                        <div className="text-xs text-secondary mt-1">Grounding: {it.grounding?.map((g: GroundingSource) => `${g.metric_name}: ${g.metric_value}`).join('; ')}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3) RECOMMENDATIONS */}
        <section className="bg-light-surface dark:bg-dark-surface border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-lg font-bold tracking-wide text-light-text dark:text-dark-text capitalize mb-6 border-b border-border pb-2">Recommendations</h2>

          <div className="space-y-4">
            {recs.slice(0, 5).map((rec, idx) => (
              <div key={idx} className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg border border-border">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      {getPriorityBadge(rec.priority)}
                      <h3 className="font-bold text-sm text-light-text dark:text-dark-text">{rec.title}</h3>
                    </div>
                    <div className="text-xs text-secondary mt-2 leading-relaxed prose prose-sm max-w-none">
                      <ReactMarkdown>{rec.details}</ReactMarkdown>
                    </div>
                  </div>
                  <div className="text-xs text-secondary font-mono">Conf: {rec.confidence_score?.toFixed(2) ?? '—'}</div>
                </div>
                <div className="mt-3 bg-light-bg dark:bg-dark-bg p-3 rounded-md border border-border text-[11px] text-secondary">
                  <strong className="text-primary uppercase tracking-widest text-[9px] block mb-0.5">Expected Outcome</strong>
                  {rec.expected_outcome}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4) AI CHAT */}
        <section className="bg-light-surface dark:bg-dark-surface border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-3 border-b border-border pb-4 mb-5">
            <MessageSquare className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-lg font-bold tracking-wide text-light-text dark:text-dark-text capitalize">AI Chatbot for Assistance</h2>
              <p className="text-xs text-secondary mt-1">Ask questions about this audit's findings</p>
            </div>
          </div>

          {/* Message thread (existing) */}
          <div className="max-h-80 overflow-y-auto space-y-3 p-3 bg-light-bg dark:bg-dark-surface rounded-2xl border border-border">
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
                    : 'bg-light-surface dark:bg-dark-surface border border-border'
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
              <div className="flex items-center gap-2 px-4 py-3 bg-light-surface dark:bg-dark-surface border border-border rounded-xl text-secondary text-sm">
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                <span>Thinking...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input (existing) */}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 mt-4">
            <input
              type="text"
              placeholder="Ask a question about this audit..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="
                w-full bg-light-bg dark:bg-dark-bg border border-border rounded-xl
                px-4 py-3 text-sm text-light-text dark:text-dark-text
                focus:outline-none focus:border-primary
                placeholder:text-secondary/50
              "
            />
            <button
              type="submit"
              disabled={chatLoading}
              className="bg-primary hover:bg-primary-hover p-3 rounded-xl text-white transition flex-shrink-0 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>

        {showInsightLogs && dbLogDetail && (
          <section className="bg-light-surface dark:bg-dark-surface border border-primary/20 rounded-3xl p-6 space-y-4">
            <div className="flex items-center space-x-2 border-b border-border pb-3">
              <Cpu className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-xs uppercase tracking-wider text-secondary">
                Audit Reasoning Trace
              </h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-[11px] font-mono">
              <div>
                <span className="font-semibold text-secondary uppercase tracking-widest text-[9px] block mb-1">
                  System Prompt
                </span>
                <pre className="p-3 bg-light-bg dark:bg-dark-bg rounded-xl border border-border text-secondary overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {dbLogDetail.system_prompt}
                </pre>
              </div>
              <div>
                <span className="font-semibold text-secondary uppercase tracking-widest text-[9px] block mb-1">
                  User Prompt Payload
                </span>
                <pre className="p-3 bg-light-bg dark:bg-dark-bg rounded-xl border border-border text-secondary overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {dbLogDetail.user_prompt}
                </pre>
              </div>
            </div>
          </section>
        )}

      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-light-surface/70 dark:bg-dark-surface/70 py-6 text-center text-xs text-secondary">
        <p>&copy; 2026 EIGHT25MEDIA &middot; WebCrawler — Professional SEO &amp; Conversion Audit Platform</p>
      </footer>
    </div>
  );
}
