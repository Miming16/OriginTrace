import { useState } from 'react';
import ExtractedFileSummary from '../../components/ExtractedFileSummary';
import FlagPanel from '../../components/FlagPanel';
import OriginalityCallPanel from '../../components/OriginalityCallPanel';
import SubmissionListView from './SubmissionListView';
import { SUBMISSIONS } from './mockSubmissions';
import { getFlagsFor } from './mockFlags';

const RISK_META = {
  Low: { cls: 'low', text: 'text-risk-low' },
  Medium: { cls: 'medium', text: 'text-risk-medium' },
  High: { cls: 'high', text: 'text-risk-high' },
};

const KPI = [
  { key: 'total', label: 'Total submissions', value: SUBMISSIONS.length, accent: 'border-secondary' },
  { key: 'high', label: 'High risk', value: SUBMISSIONS.filter((s) => s.risk === 'High').length, accent: 'border-risk-high' },
  { key: 'medium', label: 'Medium risk', value: SUBMISSIONS.filter((s) => s.risk === 'Medium').length, accent: 'border-risk-medium' },
  { key: 'low', label: 'Low risk', value: SUBMISSIONS.filter((s) => s.risk === 'Low').length, accent: 'border-risk-low' },
];

export default function InstructorDashboard() {
  const [selectedId, setSelectedId] = useState(null);
  const [decisions, setDecisions] = useState({}); // { [submissionId]: { value, decidedAt } }

  const selected = SUBMISSIONS.find((s) => s.id === selectedId);
  const flags = selected ? getFlagsFor(selected.id) : [];
  const decision = selected ? decisions[selected.id] : null;

  function handleDecide(value) {
    setDecisions((prev) => ({
      ...prev,
      [selected.id]: { value, decidedAt: new Date().toISOString() },
    }));
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {KPI.map((k) => (
          <div key={k.key} className={`bg-white p-5 rounded-xl shadow-sm border-l-4 ${k.accent}`}>
            <p className="text-xs font-semibold text-slate-text-muted">{k.label}</p>
            <h3 className="text-2xl font-bold mt-1">{k.value}</h3>
          </div>
        ))}
      </div>

      <SubmissionListView onSelect={setSelectedId} selectedId={selectedId} />

      <div className="mt-6 bg-white border border-border-standard rounded-xl p-6">
        <h5 className="font-bold mb-3">Detail panel</h5>
        {!selected ? (
          <p className="text-sm text-slate-text-muted">Select a submission above to view details.</p>
        ) : (
          <>
            <ExtractedFileSummary summary={selected.fileSummary} />

            <div className="mt-4">
              <h6 className="text-xs font-bold uppercase text-slate-text-muted mb-2">
                Commit-pattern & provenance flags
              </h6>
              <FlagPanel flags={flags} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div className="p-3 border border-dashed border-border-standard rounded-lg text-xs text-slate-text-muted">
                Matched fragments — see Clusters for side-by-side comparisons (7.2)
              </div>
              <div className={`p-3 border border-dashed border-border-standard rounded-lg text-xs font-bold ${RISK_META[selected.risk].text}`}>
                Risk band: {selected.risk} — pending 6.3
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-border-standard">
              <h6 className="text-xs font-bold uppercase text-slate-text-muted mb-2">Final originality call</h6>
              <OriginalityCallPanel decision={decision} onDecide={handleDecide} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
