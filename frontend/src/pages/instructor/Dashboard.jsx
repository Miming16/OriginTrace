import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Dashboard.css';

// Mock data — replaced by live API calls in 7.5 (Instructor Dashboard API Integration)
const MOCK_SUBMISSIONS = [
  { id: 1, student: 'J. Dela Cruz', subject: 'CS101', riskBand: 'Low', status: 'Complete' },
  { id: 2, student: 'M. Santos', subject: 'CS101', riskBand: 'High', status: 'Complete' },
  { id: 3, student: 'A. Reyes', subject: 'CS205', riskBand: 'Medium', status: 'Processing' },
];

const NAV_ITEMS = ['Submissions', 'Subjects', 'Clusters', 'Settings'];

export default function InstructorDashboard() {
  const { user, logout } = useAuth();
  const [selectedId, setSelectedId] = useState(null);
  const [activeNav, setActiveNav] = useState('Submissions');

  const selected = MOCK_SUBMISSIONS.find((s) => s.id === selectedId);

  return (
    <div className="dash">
      <div className="dash-topbar">
        <span className="dash-brand">OriginTrace</span>
        <span className="dash-user">Instructor: {user?.fullName || '[name]'} · <button className="dash-linklike" onClick={logout}>Sign out</button></span>
      </div>

      <div className="dash-body">
        <div className="dash-sidebar">
          {NAV_ITEMS.map((item) => (
            <div
              key={item}
              className={`dash-navitem ${activeNav === item ? 'active' : ''}`}
              onClick={() => setActiveNav(item)}
            >
              {item}
            </div>
          ))}
        </div>

        <div className="dash-main">
          <h2 className="dash-heading">Submission list</h2>

          <table className="dash-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Subject</th>
                <th>Risk band</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_SUBMISSIONS.map((s) => (
                <tr
                  key={s.id}
                  className={selectedId === s.id ? 'selected' : ''}
                  onClick={() => setSelectedId(s.id)}
                >
                  <td>{s.student}</td>
                  <td>{s.subject}</td>
                  <td><span className={`badge badge-${s.riskBand.toLowerCase()}`}>{s.riskBand}</span></td>
                  <td>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="dash-heading">Detail panel</h2>
          <div className="dash-detail-panel">
            {!selected ? (
              <p className="dash-empty">Select a submission above to view details.</p>
            ) : (
              <>
                <div className="dash-detail-grid">
                  <div className="dash-detail-box">Matched fragments — pending 3.2 / 7.2</div>
                  <div className="dash-detail-box">Peer overlaps — pending 6.2 / 7.2</div>
                  <div className="dash-detail-box">Commit / provenance flags — pending 4.x / 5.x / 7.3</div>
                  <div className="dash-detail-box">Risk band: {selected.riskBand} — pending 6.3</div>
                </div>
                <div className="dash-actions">
                  <button disabled>Clear</button>
                  <button disabled>Flag for review</button>
                  <button disabled>Mark under review</button>
                </div>
                <p className="dash-note">Final-call actions wired up in 7.4.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
