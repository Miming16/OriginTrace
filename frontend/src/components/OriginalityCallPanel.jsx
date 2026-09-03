const OPTIONS = [
  { value: 'cleared', label: 'Clear', stateLabel: 'Cleared', icon: 'check_circle', activeCls: 'bg-risk-low text-white border-risk-low' },
  { value: 'under_review', label: 'Mark under review', stateLabel: 'Under Review', icon: 'hourglass_top', activeCls: 'bg-risk-medium text-white border-risk-medium' },
  { value: 'flagged', label: 'Flag for review', stateLabel: 'Flagged', icon: 'flag', activeCls: 'bg-risk-high text-white border-risk-high' },
];

function formatTimestamp(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function OriginalityCallPanel({ decision, onDecide }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const isActive = decision?.value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onDecide(opt.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold border transition ${
                isActive
                  ? opt.activeCls
                  : 'border-border-standard text-slate-text-secondary hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{opt.icon}</span>
              {opt.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-text-muted mt-3">
        {decision
          ? <>Current call: <strong className="text-primary">{OPTIONS.find((o) => o.value === decision.value)?.stateLabel}</strong> — recorded {formatTimestamp(decision.decidedAt)}</>
          : 'No decision recorded yet for this submission.'}
      </p>
      <p className="text-[11px] text-slate-text-muted italic mt-1">
        The system only flags for review — this decision is always made by the instructor, never automatically.
      </p>
    </div>
  );
}
