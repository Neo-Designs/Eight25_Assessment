'use client';

import { getScoreColor } from '@/lib/scores';

export default function ScoreBadge({ score }: { score: number | null }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-bold font-mono ${getScoreColor(score)}`}>
      {score !== null ? `${score}/100` : 'N/A'}
    </span>
  );
}
