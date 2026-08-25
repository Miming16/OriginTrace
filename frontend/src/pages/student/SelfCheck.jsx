import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

// Mock quota — real limit comes from 6.4 (Rate-Limiting for Student Self-Checks)
const QUOTA = { used: 1, limit: 3 };

export default function StudentSelfCheck() {
  const { user, logout } = useAuth();
  const [repoUrl, setRepoUrl] = useState('');
  const [result, setResult] = useState(null); // null | 'checking' | { band }

  const remaining = QUOTA.limit - QUOTA.used;

  function handleSubmit(e) {
    e.preventDefault();
    if (remaining <= 0) return;
    setResult('checking');
    // No backend yet — 3.5 (Submission API) and 8.3 wire this up for real.
    setTimeout(() => setResult({ band: 'low' }), 1200);
  }

  const bandStyles = {
    low: { badge: 'risk-badge low', label: 'LOW' },
    medium: { badge: 'risk-badge medium', label: 'MEDIUM' },
    high: { badge: 'risk-badge high', label: 'HIGH' },
  };

  return (
    <div className="min-h-screen bg-background text-primary">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-standard bg-white">
        <span className="font-bold text-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">shield</span> OriginTrace
        </span>
        <span className="text-sm text-slate-text-secondary">
          Student: {user?.fullName || '[name]'}
          <button onClick={logout} className="ml-2 text-secondary font-bold">Sign out</button>
        </span>
      </div>

      <div className="max-w-md mx-auto p-6">
        <div className="bg-white border border-border-standard rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-lg mb-1">Self-check submission</h3>
          <p className="text-xs text-slate-text-muted mb-4">{remaining} of {QUOTA.limit} checks remaining today</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-text-secondary block mb-1">Git repo URL</label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full border border-border-standard rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-slate-text-muted text-center">or</p>
            <div className="border-2 border-dashed border-border-standard rounded-lg p-6 text-center text-xs text-slate-text-muted">
              Drop file / browse to upload
            </div>
            <button
              type="submit"
              disabled={remaining <= 0 || result === 'checking'}
              className="w-full bg-secondary text-white py-2.5 rounded-lg text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {result === 'checking' ? 'Analyzing…' : 'Run self-check'}
            </button>
          </form>
        </div>

        <div className="mt-6 bg-white border border-border-standard rounded-xl p-6 shadow-sm text-center">
          <h3 className="font-bold text-sm mb-3">Result</h3>
          {!result || result === 'checking' ? (
            <p className="text-sm text-slate-text-muted">
              {result === 'checking' ? 'Processing…' : 'No submission yet.'}
            </p>
          ) : (
            <>
              <span className={bandStyles[result.band].badge}>{bandStyles[result.band].label}</span>
              <p className="text-[11px] text-slate-text-muted mt-3 border-t border-border-standard pt-3">
                Real risk band + guidance shown here once 3.5 / 8.2 are wired up.
                Only the aggregate result will ever appear — no matched files or peer names.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
