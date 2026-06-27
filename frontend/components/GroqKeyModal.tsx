'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, ExternalLink, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { API_BASE } from '@shared/api';

interface GroqKeyModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GroqKeyModal({ open, onClose, onSuccess }: GroqKeyModalProps) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed.startsWith('gsk_')) {
      setError('A valid Groq API key starts with "gsk_".');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/update-groq-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Server error ${res.status}`);
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setKey('');
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="groq-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            key="groq-modal-card"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative w-full max-w-md bg-light-surface dark:bg-dark-surface border border-amber-500/30 rounded-3xl p-8 shadow-2xl shadow-amber-500/10"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-secondary hover:text-light-text dark:hover:text-dark-text transition"
              id="groq-modal-close"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Icon + heading */}
            <div className="flex flex-col items-center text-center mb-6 space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                <KeyRound className="h-7 w-7 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-light-text dark:text-dark-text">Groq API Quota Reached</h2>
                <p className="text-xs text-secondary mt-1 leading-relaxed">
                  Your current Groq API key has hit its rate limit. Paste a new key below to
                  continue without restarting the server.
                </p>
              </div>
            </div>

            {/* Get a key link */}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition mb-5"
            >
              <ExternalLink className="h-3 w-3" />
              Get a free Groq API key at console.groq.com
            </a>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="groq-key-input" className="text-xs text-secondary font-mono uppercase tracking-wider block mb-1.5">
                  New Groq API Key
                </label>
                <input
                  id="groq-key-input"
                  type="password"
                  placeholder="gsk_..."
                  value={key}
                  onChange={(e) => { setKey(e.target.value); setError(null); }}
                  className="
                    w-full bg-light-bg dark:bg-dark-bg border border-border rounded-xl
                    px-4 py-3 text-sm font-mono text-light-text dark:text-dark-text
                    focus:outline-none focus:border-amber-400
                    placeholder:text-secondary/40
                  "
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  Key updated! Retrying audit…
                </div>
              )}

              <button
                id="groq-key-submit"
                type="submit"
                disabled={loading || success || !key.trim()}
                className="
                  w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50
                  text-white font-semibold py-3 rounded-xl text-sm transition
                  flex items-center justify-center gap-2
                "
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Updating Key…</>
                ) : success ? (
                  <><CheckCircle2 className="h-4 w-4" /> Updated!</>
                ) : (
                  <><KeyRound className="h-4 w-4" /> Update & Retry</>
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
