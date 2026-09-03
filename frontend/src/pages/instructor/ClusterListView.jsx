import { useNavigate } from 'react-router-dom';
import { CLUSTERS } from './mockClusters';

const RISK_CLS = { Low: 'low', Medium: 'medium', High: 'high' };

export default function ClusterListView() {
  const navigate = useNavigate();

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Similarity clusters</h2>
      <p className="text-sm text-slate-text-muted mb-6">
        Groups of submissions above the similarity threshold. Every party in a cluster is shown — not just one pair.
      </p>

      <div className="bg-white border border-border-standard rounded-xl overflow-hidden shadow-sm divide-y divide-border-standard">
        {CLUSTERS.map((c) => (
          <div
            key={c.id}
            onClick={() => navigate(`/instructor/clusters/${c.id}`)}
            className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-surface-container-low transition"
          >
            <div>
              <p className="font-semibold text-primary">Cluster #{c.id} · {c.section}</p>
              <p className="text-xs text-slate-text-muted">{c.members.length} parties · {c.members.join(', ')}</p>
            </div>
            <span className={`risk-badge ${RISK_CLS[c.risk]}`}>{c.risk}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
