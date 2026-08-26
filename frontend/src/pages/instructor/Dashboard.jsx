import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import ExtractedFileSummary from '../../components/ExtractedFileSummary';


const SUBMISSIONS = [
  {
    id: 1, name: 'E. Winters', course: 'CS302', assignment: 'Project 2', lang: 'Java', risk: 'High', flags: 4, time: '2d ago',
    fileSummary: { includedCount: 18, excludedBreakdown: [{ reason: 'node_modules', count: 112 }, { reason: 'vendor', count: 6 }] },
  },
  {
    id: 2, name: 'S. Connor', course: 'CS101', assignment: 'Lab 5', lang: 'Python', risk: 'Medium', flags: 1, time: '4h ago',
    fileSummary: { includedCount: 6, excludedBreakdown: [{ reason: '__pycache__', count: 3 }] },
  },
  {
    id: 3, name: 'A. Adams', course: 'CS205', assignment: 'Assignment 3', lang: 'JavaScript', risk: 'Low', flags: 0, time: '1d ago',
    fileSummary: { includedCount: 9, excludedBreakdown: [] },
  },
];

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'subjects', label: 'Subjects', icon: 'school' },
  { key: 'clusters', label: 'Clusters', icon: 'hub' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

const RISK_META = {
  Low: { cls: 'low', border: 'border-risk-low', text: 'text-risk-low' },
  Medium: { cls: 'medium', border: 'border-risk-medium', text: 'text-risk-medium' },
  High: { cls: 'high', border: 'border-risk-high', text: 'text-risk-high' },
};

const KPI = [
  { key: 'total', label: 'Total submissions', value: SUBMISSIONS.length, accent: 'border-secondary' },
  { key: 'high', label: 'High risk', value: SUBMISSIONS.filter((s) => s.risk === 'High').length, accent: 'border-risk-high' },
  { key: 'medium', label: 'Medium risk', value: SUBMISSIONS.filter((s) => s.risk === 'Medium').length, accent: 'border-risk-medium' },
  { key: 'low', label: 'Low risk', value: SUBMISSIONS.filter((s) => s.risk === 'Low').length, accent: 'border-risk-low' },
];

export default function InstructorDashboard() {
  const { user, logout } = useAuth();
  const [activeNav, setActiveNav] = useState('dashboard');
  const [selectedId, setSelectedId] = useState(null);

  const selected = SUBMISSIONS.find((s) => s.id === selectedId);

  return (
    <div className="min-h-screen flex bg-background text-primary">
      <div className="w-56 border-r border-border-standard p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 px-2 py-3 mb-2">
          <span className="material-symbols-outlined text-secondary">shield</span>
          <span className="font-bold text-lg">OriginTrace</span>
        </div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveNav(item.key)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
              activeNav === item.key ? 'bg-secondary text-white font-bold' : 'text-slate-text-secondary hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            {item.label}
          </button>
        ))}
        <div className="mt-auto px-3 py-2 text-xs text-slate-text-muted">
          Instructor: {user?.fullName || '[name]'}
          <button onClick={logout} className="block text-secondary font-bold mt-1">Sign out</button>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {KPI.map((k) => (
            <div key={k.key} className={`bg-white p-5 rounded-xl shadow-sm border-l-4 ${k.accent}`}>
              <p className="text-xs font-semibold text-slate-text-muted">{k.label}</p>
              <h3 className="text-2xl font-bold mt-1">{k.value}</h3>
            </div>
          ))}
        </div>

        <div className="bg-white border border-border-standard rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-surface-container-low border-b border-border-standard flex justify-between items-center">
            <h5 className="font-bold text-primary">Submissions</h5>
            <span className="text-xs text-slate-text-muted">{SUBMISSIONS.length} shown</span>
          </div>
          <div className="divide-y divide-border-standard">
            {SUBMISSIONS.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`flex items-center justify-between gap-4 px-5 py-3 cursor-pointer hover:bg-surface-container-low transition ${
                  selectedId === s.id ? 'bg-secondary/5' : ''
                }`}
              >
                <div>
                  <p className="font-semibold text-primary">{s.name}</p>
                  <p className="text-xs text-slate-text-muted">{s.course} · {s.assignment} · {s.time}</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded">{s.lang}</span>
                  <span className="text-xs text-slate-text-muted w-14">{s.flags} flag{s.flags === 1 ? '' : 's'}</span>
                  <span className={`risk-badge ${RISK_META[s.risk].cls}`}>{s.risk}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 bg-white border border-border-standard rounded-xl p-6">
          <h5 className="font-bold mb-3">Detail panel</h5>
          {!selected ? (
            <p className="text-sm text-slate-text-muted">Select a submission above to view details.</p>
          ) : (
            <>
              <ExtractedFileSummary summary={selected.fileSummary} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div className="p-3 border border-dashed border-border-standard rounded-lg text-xs text-slate-text-muted">
                  Matched fragments — pending 3.2 / 7.2
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
    </div>
  );
}
