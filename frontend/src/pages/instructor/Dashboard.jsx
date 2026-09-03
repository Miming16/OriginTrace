import { useState } from 'react';
import ExtractedFileSummary from '../../components/ExtractedFileSummary';
import SubmissionListView from './SubmissionListView';
import { SUBMISSIONS } from './mockSubmissions';

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
  const selected = SUBMISSIONS.find((s) => s.id === selectedId);

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="p-3 border border-dashed border-border-standard rounded-lg text-xs text-slate-text-muted">
                Matched fragments — see Clusters for side-by-side comparisons (7.2)
              </div>
              <div className="p-3 border border-dashed border-border-standard rounded-lg text-xs text-slate-text-muted">
                Peer overlaps — pending 6.2 / 7.2
              </div>
              <div className="p-3 border border-dashed border-border-standard rounded-lg text-xs text-slate-text-muted">
                Commit / provenance flags — pending 4.x / 5.x / 7.3
              </div>
              <div className={`p-3 border border-dashed border-border-standard rounded-lg text-xs font-bold ${RISK_META[selected.risk].text}`}>
                Risk band: {selected.risk} — pending 6.3
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button disabled className="px-4 py-2 rounded-lg text-sm font-bold border border-border-standard text-slate-text-muted">Clear</button>
              <button disabled className="px-4 py-2 rounded-lg text-sm font-bold border border-border-standard text-slate-text-muted">Flag for review</button>
              <button disabled className="px-4 py-2 rounded-lg text-sm font-bold border border-border-standard text-slate-text-muted">Mark under review</button>
            </div>
            <p className="text-[11px] text-slate-text-muted mt-2">Final-call actions wired up in 7.4.</p>
          </>
        )}
      </div>
    </div>
  );
}
