import { useParams, useNavigate, Link } from 'react-router-dom';
import { CLUSTERS } from './mockClusters';

const RISK_CLS = { Low: 'low', Medium: 'medium', High: 'high' };
const RISK_BAR = { Low: '#22c55e', Medium: '#f59e0b', High: '#ef4444' };

export default function ClusterDetailView() {
  const { clusterId } = useParams();
  const navigate = useNavigate();
  const cluster = CLUSTERS.find((c) => String(c.id) === clusterId);

  if (!cluster) {
    return (
      <div>
        <p className="text-sm text-slate-text-muted mb-4">Cluster not found.</p>
        <Link to="/instructor/clusters" className="text-secondary font-semibold text-sm">← Back to clusters</Link>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => navigate('/instructor/clusters')} className="text-secondary font-semibold text-sm mb-4">
        ← Back to clusters
      </button>

      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold">Cluster #{cluster.id} · {cluster.section}</h2>
        <span className={`risk-badge ${RISK_CLS[cluster.risk]}`}>{cluster.risk}</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {cluster.members.map((m) => (
          <span key={m} className="text-xs bg-surface-container-high px-3 py-1 rounded-full flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">person</span>{m}
          </span>
        ))}
      </div>

      <div className="bg-white border border-border-standard rounded-xl p-6 shadow-sm">
        <h4 className="font-bold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">difference</span> Matched fragments
        </h4>

        {cluster.matches.map((m, i) => (
          <div key={i} className="border border-border-standard rounded-lg overflow-hidden mb-3 last:mb-0">
            <div className="flex items-center justify-between px-4 py-2.5 bg-surface-container-low border-b border-border-standard flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-[18px] text-slate-text-muted">compare_arrows</span>
                <span className="font-bold text-primary">{m.memberA}</span>
                <span className="text-slate-text-muted">vs</span>
                <span className="font-bold text-primary">{m.memberB}</span>
                <span className="text-xs text-slate-text-muted">· {m.file}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full" style={{ width: `${m.pct}%`, background: RISK_BAR[cluster.risk] }} />
                </div>
                <span className="text-sm font-bold" style={{ color: RISK_BAR[cluster.risk] }}>{m.pct}% match</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="border-b md:border-b-0 md:border-r border-border-standard">
                <p className="px-3 pt-2 text-[10px] font-bold uppercase text-slate-text-muted">{m.memberA}</p>
                <pre className="font-mono text-xs p-3 overflow-auto text-primary whitespace-pre-wrap">{m.left}</pre>
              </div>
              <div>
                <p className="px-3 pt-2 text-[10px] font-bold uppercase text-slate-text-muted">{m.memberB}</p>
                <pre className="font-mono text-xs p-3 overflow-auto text-primary whitespace-pre-wrap">{m.right}</pre>
              </div>
            </div>
          </div>
        ))}

        <p className="text-xs text-slate-text-muted italic mt-2">
          Matched fragments are visible to instructors only — students see aggregate results only (per the must-haves).
        </p>
      </div>
    </div>
  );
}
