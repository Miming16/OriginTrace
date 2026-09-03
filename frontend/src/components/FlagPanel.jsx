import { useState } from 'react';

const SEVERITY_CLS = {
  Low: 'bg-risk-low/10 text-risk-low',
  Medium: 'bg-risk-medium/10 text-risk-medium',
  High: 'bg-risk-high/10 text-risk-high',
};

const CATEGORY_ICON = {
  commit: 'commit',
  provenance: 'fingerprint',
};

function FlagCard({ flag }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border-standard rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-container-low transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="material-symbols-outlined text-slate-text-muted text-[20px]">
            {CATEGORY_ICON[flag.category]}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-primary truncate">{flag.type}</p>
            <p className="text-[11px] text-slate-text-muted truncate">{flag.source}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${SEVERITY_CLS[flag.severity]}`}>
            {flag.severity}
          </span>
          <span className="material-symbols-outlined text-slate-text-muted text-[18px]">
            {open ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border-standard">
          <p className="text-sm text-slate-text-secondary mb-2">{flag.explanation}</p>
          <p className="text-[11px] font-bold uppercase text-slate-text-muted mb-1">Evidence</p>
          <pre className="font-mono text-xs bg-surface-container-low border border-border-standard rounded-md p-3 overflow-auto whitespace-pre-wrap">
            {flag.evidence}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function FlagPanel({ flags }) {
  if (flags.length === 0) {
    return (
      <div className="border border-dashed border-border-standard rounded-lg p-4 text-sm text-slate-text-muted text-center">
        No commit-pattern or provenance flags for this submission.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-text-muted italic mb-1">
        Every flag here is a soft signal, not a verdict — the instructor makes the final call (7.4).
      </p>
      {flags.map((flag) => (
        <FlagCard key={flag.id} flag={flag} />
      ))}
    </div>
  );
}
