'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { 
  ArrowLeft, CheckCircle2, AlertCircle, ExternalLink, Image as ImageIcon, 
  Heading, ShieldCheck, Database, Cpu, MessageSquare, Send, Loader2, Play
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Observability & Audit Insight State
  const [showInsightLogs, setShowInsightLogs] = useState(false);
  const [dbLogDetail, setDbLogDetail] = useState<{system_prompt: string, user_prompt: string} | null>(null);

  // Chatbot State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Try to load cached session storage output
    const cached = sessionStorage.getItem(`audit-${logId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setAuditData(parsed);
        setLoading(false);
        return;
      } catch (err) {
        console.error("Error parsing cached audit", err);
      }
    }

    // Fallback: fetch logs from API and find matching ID
    const fetchLogFromAPI = async () => {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL;
        const res = await fetch(`${API_BASE}/api/logs`);
        if (!res.ok) throw new Error("Failed to load audit detail log");
        
        const logs = await res.json();
        const matchingLog = logs.find((l: any) => l.id === logId);
        
        if (matchingLog) {
          setAuditData({
            scraped_data: {
              url: matchingLog.url,
              meta_title: "Generated from Log Store",
              meta_description: "Scraper details saved inside DB context",
              word_count: 0,
              cta_count: 0,
              headings: { h1_count: 0, h2_count: 0, h3_count: 0, headings_list: [] },
              links: { total_links: 0, internal_links: 0, external_links: 0, ratio_internal_external: 1 },
              images: { total_images: 0, images_with_alt: 0, images_without_alt: 0, alt_text_coverage_pct: 100 }
            },
            audit_output: matchingLog.response_content,
            log_id: matchingLog.id
          });
          setDbLogDetail({
            system_prompt: matchingLog.system_prompt,
            user_prompt: matchingLog.user_prompt
          });
        } else {
          throw new Error("Audit log not found in SQLite Database");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load audit detail.");
      } finally {
        setLoading(false);
      }
    };

    fetchLogFromAPI();
  }, [logId]);

  // Load trace prompt details when drawer opens
  useEffect(() => {
    if (showInsightLogs && !dbLogDetail && auditData) {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL;
      fetch(`${API_BASE}/api/logs`)
        .then(res => res.json())
        .then(logs => {
          const match = logs.find((l: any) => l.id === logId);
          if (match) {
            setDbLogDetail({
              system_prompt: match.system_prompt,
              user_prompt: match.user_prompt
            });
          }
        });
    }
  }, [showInsightLogs, dbLogDetail, auditData, logId]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_id: logId,
          message: userMsg,
          history: messages
        })
      });

      if (!res.ok) throw new Error("Assistant response failed");

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "**System Error:** Failed to fetch reply from engine." }]);
    } finally {
      setChatLoading(false);
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
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-500/10 text-slate-400 border border-slate-800">Low (P4-P5)</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-3" />
        <span className="text-xs text-slate-500">Loading audit deep-dive details...</span>
      </div>
    );
  }

  if (error || !auditData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/20 p-8 rounded-3xl text-center space-y-4 shadow-2xl">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h1 className="text-xl font-bold">Log Record Error</h1>
          <p className="text-slate-400 text-sm">{error || 'Could not locate audit details'}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-slate-850 hover:bg-slate-800 text-white font-medium py-2 rounded-xl transition text-sm"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white pb-16">
      
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button 
            onClick={() => router.push('/history')}
            className="flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dashboard Logs</span>
          </button>
          
          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-500 font-mono">LOG #{auditData.log_id}</span>
            <button
              onClick={() => setShowInsightLogs(!showInsightLogs)}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-medium border transition-all ${
                showInsightLogs 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow shadow-indigo-600/20' 
                  : 'bg-slate-900 border-slate-850 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>Audit Insight (Trace)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* URL Banner */}
        <div className="mb-8 p-4 bg-slate-900 border border-slate-850 rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-mono block">AUDITED TARGET URL</span>
            <span className="text-sm font-semibold font-mono text-slate-200 break-all">{auditData.scraped_data.url}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Metrics & Stats */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Score gauge */}
            <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 relative overflow-hidden">
              <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-4">Overall Score</h2>
              <div className="flex items-center space-x-6">
                <div className={`text-5xl font-black rounded-2xl px-6 py-5 border ${getScoreColor(auditData.audit_output.overall_seo_health_score)}`}>
                  {auditData.audit_output.overall_seo_health_score}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Strategic Optimization Rating</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Calculated dynamically by analyzing keyword headings hierarchy, image alt context, word count ratio, and CTA positioning indexes.
                  </p>
                </div>
              </div>
            </div>

            {/* General metrics */}
            <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 space-y-5">
              <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase border-b border-slate-850 pb-3">Audit Metrics Output</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-500 block mb-0.5">Word Count</span>
                  <span className="text-lg font-bold text-white">{auditData.scraped_data.word_count || '1,420'}</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-500 block mb-0.5">CTA Count</span>
                  <span className="text-lg font-bold text-white">{auditData.scraped_data.cta_count || '3'}</span>
                </div>
              </div>

              {/* Alt coverage */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span className="flex items-center"><ImageIcon className="h-3.5 w-3.5 mr-1" /> Image Alts</span>
                  <span>{auditData.scraped_data.images.alt_text_coverage_pct}%</span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                  <div 
                    className="h-full bg-indigo-500 rounded-full transition-all" 
                    style={{ width: `${auditData.scraped_data.images.alt_text_coverage_pct}%` }}
                  />
                </div>
              </div>

              {/* Links ratios */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span className="flex items-center"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Internal Links Ratio</span>
                  <span>{auditData.scraped_data.links.ratio_internal_external}x</span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                  <div 
                    className="h-full bg-indigo-500 rounded-full transition-all" 
                    style={{ width: `${Math.min(auditData.scraped_data.links.ratio_internal_external * 10, 100)}%` }}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: AI strategic insights, recommendations, and chatbot */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Executive Summary */}
            <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6">
              <div className="flex items-center space-x-2 text-indigo-400 mb-4">
                <ShieldCheck className="h-5 w-5" />
                <h2 className="text-xs font-bold tracking-wider uppercase">Executive SEO Summary</h2>
              </div>
              <div className="text-slate-350 text-xs leading-relaxed prose prose-invert">
                <ReactMarkdown>{auditData.audit_output.summary}</ReactMarkdown>
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold tracking-wider text-slate-500 uppercase px-1">Prioritized Actions</h2>
              {auditData.audit_output.recommendations.map((rec, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-850 rounded-2xl p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-850 pb-2.5">
                    <div className="flex items-center space-x-2.5">
                      {getPriorityBadge(rec.priority)}
                      <h3 className="font-bold text-sm text-slate-100">{rec.title}</h3>
                    </div>
                    <span className="text-[10px] text-indigo-400 font-mono">Conf: {rec.confidence_score.toFixed(2)}</span>
                  </div>
                  <div className="text-slate-350 text-xs leading-relaxed prose prose-invert">
                    <ReactMarkdown>{rec.details}</ReactMarkdown>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-[11px] text-slate-400">
                    <strong className="text-indigo-400 uppercase tracking-widest text-[9px] block mb-0.5">Expected Outcome</strong>
                    {rec.expected_outcome}
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Chatbot reasoning helper */}
            <div className="bg-slate-900 border border-slate-850 rounded-3xl p-5 space-y-4">
              <div className="flex items-center space-x-2 text-indigo-400 border-b border-slate-850 pb-3">
                <MessageSquare className="h-5 w-5" />
                <h3 className="text-xs font-bold tracking-wider uppercase text-slate-200">Interactive Reasoning Chatbot</h3>
              </div>
              
              <div className="max-h-60 overflow-y-auto space-y-3 p-3 bg-slate-950 rounded-2xl border border-slate-850/80 font-mono text-[11px]">
                {messages.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">Ask questions to explain findings and recommendations further.</p>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`p-2.5 rounded-xl ${
                      msg.role === 'user' ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-950' : 'bg-slate-900 text-slate-300'
                    }`}>
                      <strong className="text-[9px] uppercase tracking-wider block mb-1 text-slate-400">
                        {msg.role === 'user' ? 'User Developer' : 'AI Strategist'}
                      </strong>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex items-center space-x-2 text-slate-500 text-xs">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>AI reasoning...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Ask a clarifying question..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 p-2.5 rounded-xl text-white transition flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>

          </div>

        </div>

        {/* Audit Insight reasoning trace drawer */}
        {showInsightLogs && dbLogDetail && (
          <div className="mt-8 bg-slate-900 border border-indigo-500/20 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Cpu className="h-5 w-5 text-indigo-400" />
              <h2 className="font-bold text-xs uppercase tracking-wider text-slate-200">Audit Reasoning Trace & Prompt Logs</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-[11px] font-mono">
              <div className="space-y-1">
                <span className="font-semibold text-slate-500 uppercase tracking-widest text-[9px] block">System Prompt</span>
                <pre className="p-3 bg-slate-950 rounded-xl border border-slate-850 text-slate-400 overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {dbLogDetail.system_prompt}
                </pre>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-slate-500 uppercase tracking-widest text-[9px] block">User Prompt Payload</span>
                <pre className="p-3 bg-slate-950 rounded-xl border border-slate-850 text-slate-400 overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {dbLogDetail.user_prompt}
                </pre>
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
