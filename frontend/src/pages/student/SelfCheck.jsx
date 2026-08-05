import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './SelfCheck.css';

// Mock quota — replaced by live API response in 8.3 (rate limit comes from 6.4)
const MOCK_QUOTA = { used: 1, limit: 3 };

export default function StudentSelfCheck() {
  const { user, logout } = useAuth();
  const [repoUrl, setRepoUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    // No backend yet — 3.5 (Submission API) and 8.3 wire this up for real.
    setSubmitted(true);
  }

  const remaining = MOCK_QUOTA.limit - MOCK_QUOTA.used;

  return (
    <div className="selfcheck">
      <div className="selfcheck-topbar">
        <span className="selfcheck-brand">OriginTrace</span>
        <span className="selfcheck-user">Student: {user?.fullName || '[name]'} · <button className="selfcheck-linklike" onClick={logout}>Sign out</button></span>
      </div>

      <div className="selfcheck-card">
        <h2 className="selfcheck-heading">Self-check submission</h2>
        <p className="selfcheck-quota">{remaining} of {MOCK_QUOTA.limit} checks remaining today</p>

        <form onSubmit={handleSubmit} className="selfcheck-form">
          <label className="selfcheck-label" htmlFor="repoUrl">Git repo URL</label>
          <input
            id="repoUrl"
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/..."
            className="selfcheck-input"
          />

          <div className="selfcheck-or">or</div>

          <div className="selfcheck-dropzone">
            Drop file / browse to upload
          </div>

          <button type="submit" disabled={remaining <= 0} className="selfcheck-button">
            Run self-check
          </button>
        </form>

        <h2 className="selfcheck-heading">Result</h2>
        <div className="selfcheck-result">
          {!submitted ? (
            <p className="selfcheck-empty">No submission yet.</p>
          ) : (
            <>
              <p className="selfcheck-pending">Submitted — processing.</p>
              <p className="selfcheck-note">
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
