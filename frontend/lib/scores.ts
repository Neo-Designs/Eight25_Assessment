export function getScoreColor(score: number | null): string {
  if (score === null) return 'text-secondary bg-secondary/10 border-secondary/20';
  if (score >= 85) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (score >= 60) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
}

export function getPriorityBadgeProps(priority: number): { label: string; className: string } {
  switch (priority) {
    case 1: return { label: 'Critical (P1)', className: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' };
    case 2: return { label: 'High (P2)', className: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' };
    case 3: return { label: 'Medium (P3)', className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
    default: return { label: 'Low (P4+)', className: 'bg-secondary/10 text-secondary border border-secondary/20' };
  }
}
