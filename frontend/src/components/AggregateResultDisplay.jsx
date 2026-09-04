const BAND_META = {
  low: {
    label: 'LOW',
    cls: 'bg-risk-low/10 text-risk-low border-risk-low',
    icon: 'check_circle',
    guidance: 'Your submission shows low similarity to other work on file. No further action is needed.',
  },
  medium: {
    label: 'MEDIUM',
    cls: 'bg-risk-medium/10 text-risk-medium border-risk-medium',
    icon: 'warning',
    guidance: 'Your submission shows moderate similarity to other work. Review your citations and make sure any borrowed code, logic, or structure is properly attributed before your final submission.',
  },
  high: {
    label: 'HIGH',
    cls: 'bg-risk-high/10 text-risk-high border-risk-high',
    icon: 'error',
    guidance: 'Your submission shows high similarity to other work. We strongly recommend reviewing your code for unattributed similarities before submitting, and speaking with your instructor if you have questions about proper citation.',
  },
};

export default function AggregateResultDisplay({ band }) {
  const meta = BAND_META[band];

  if (!meta) {
    return <p className="text-sm text-slate-text-muted">No submission yet.</p>;
  }

  return (
    <div className={`border-2 rounded-xl p-5 text-center ${meta.cls}`}>
      <span className="material-symbols-outlined text-4xl">{meta.icon}</span>
      <p className="text-xs font-bold uppercase tracking-wide mt-2 mb-1">Risk band</p>
      <p className="text-2xl font-extrabold mb-3">{meta.label}</p>
      <p className="text-sm text-primary text-left leading-relaxed">{meta.guidance}</p>
    </div>
  );
}
