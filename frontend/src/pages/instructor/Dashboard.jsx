import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'collaborators', label: 'Collaborators', icon: 'group_add' },
  { key: 'courses', label: 'Courses', icon: 'school' },
  { key: 'flags', label: 'Flags', icon: 'flag' },
  { key: 'settings', label: 'Profile & Settings', icon: 'settings' },
];

const initialRequests = [
  { id: 'r1', student: 'Alex Adams', course: 'CS101', type: 'Repository access', status: 'pending' },
  { id: 'r2', student: 'Jamie Lopez', course: 'CS205', type: 'Collaborator invite', status: 'pending' },
  { id: 'r3', student: 'D. Santos', course: 'CS302', type: 'Repository access', status: 'pending' },
  { id: 'r4', student: 'M. Chen', course: 'CS302', type: 'Collaborator invite', status: 'pending' },
];

const SUBMISSIONS = [
  { id: 1, name: 'Ethan Winters', course: 'CS302', assignment: 'Project 2', lang: 'Java', risk: 'High', flags: 4, time: '2d ago' },
  { id: 2, name: 'Sarah Connor', course: 'CS101', assignment: 'Lab 5', lang: 'Python', risk: 'Medium', flags: 1, time: '4h ago' },
  { id: 3, name: 'Arthur Adams', course: 'CS205', assignment: 'Assignment 3', lang: 'JavaScript', risk: 'Low', flags: 0, time: '1d ago' },
  { id: 4, name: 'James Reyes', course: 'CS101', assignment: 'Lab 4', lang: 'C', risk: 'Medium', flags: 1, time: '6h ago' },
];

const RISK_META = {
  Low: { cls: 'risk-low', text: 'text-risk-low' },
  Medium: { cls: 'risk-medium', text: 'text-risk-medium' },
  High: { cls: 'risk-high', text: 'text-risk-high' },
};

export default function InstructorDashboard() {
  const { user, logout } = useAuth();
  const [activeNav, setActiveNav] = useState('dashboard');
  const [requests, setRequests] = useState(initialRequests);
  const [selectedId, setSelectedId] = useState(1);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const selected = SUBMISSIONS.find((s) => s.id === selectedId);

  function acceptRequest(id) {
    setRequests((current) => current.filter((item) => item.id !== id));
  }

  function declineRequest(id) {
    setRequests((current) => current.filter((item) => item.id !== id));
  }

  const kpis = [
    { label: 'Total submissions', value: '142', badge: 'dashboard' },
    { label: 'High risk', value: '8', badge: 'error' },
    { label: 'Medium risk', value: '24', badge: 'warning' },
    { label: 'Low risk', value: '110', badge: 'check_circle' },
  ];

  return (
    <div className={isSidebarCollapsed ? 'app-layout sidebar-collapsed' : 'app-layout'}>
      <aside className="sidebar">
        <button type="button" className="brand-toggle" onClick={() => setIsSidebarCollapsed((value) => !value)} aria-label="Toggle sidebar">
          <img src="/origintrace-logo.svg" alt="OriginTrace logo" className="brand-logo mini-logo" />
          <span className="brand-text">OriginTrace</span>
        </button>

        <nav className="nav-group">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={activeNav === item.key ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveNav(item.key)}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>{user?.fullName || 'Instructor'}</span>
          <button className="logout-link" onClick={logout}>Logout</button>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <h2>{activeNav === 'dashboard' ? 'Instructor Dashboard' : activeNav === 'collaborators' ? 'Collaborators' : activeNav === 'courses' ? 'Courses' : activeNav === 'flags' ? 'Flags' : 'Profile & Settings'}</h2>
          <div className="topbar-tools">
            <span className="role-pill">Instructor</span>
            <div className="avatar-circle">PR</div>
          </div>
        </header>

        <div className="content-wrap">
          {activeNav === 'dashboard' && (
            <>
              <div className="stats-grid">
                {kpis.map((stat) => (
                  <div key={stat.label} className="stat-card">
                    <div className="stat-topline">
                      <span className="material-symbols-outlined">{stat.badge}</span>
                      <span>{stat.label}</span>
                    </div>
                    <h3>{stat.value}</h3>
                  </div>
                ))}
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3>Recent submissions</h3>
                  <span className="muted">{SUBMISSIONS.length} shown</span>
                </div>

                <div className="submission-table">
                  {SUBMISSIONS.map((s) => (
                    <div
                      key={s.id}
                      className={selectedId === s.id ? 'submission-row active' : 'submission-row'}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <div>
                        <strong>{s.name}</strong>
                        <p>{s.course} · {s.assignment} · {s.time}</p>
                      </div>
                      <div className="submission-row-meta">
                        <span className="lang-pill">{s.lang}</span>
                        <span className="flag-pill">{s.flags} flags</span>
                        <span className={`risk-badge ${RISK_META[s.risk].cls}`}>{s.risk}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selected && (
                <div className="panel detail-panel">
                  <div className="panel-header">
                    <h3>{selected.name}</h3>
                    <span className={`risk-badge ${RISK_META[selected.risk].cls}`}>{selected.risk}</span>
                  </div>

                  <div className="detail-grid">
                    <div className="detail-box">
                      <h4>Matched fragments</h4>
                      <p>Similarity cluster includes 2 peer submissions with 87% structural overlap.</p>
                    </div>
                    <div className="detail-box">
                      <h4>Commit plausibility</h4>
                      <p>3 commits over 1 day, author-committer mismatch detected, force-push observed.</p>
                    </div>
                    <div className="detail-box">
                      <h4>Provenance</h4>
                      <p>Consistent device pattern but large late-night burst before deadline.</p>
                    </div>
                    <div className="detail-box emphasis">
                      <h4>Faculty verdict</h4>
                      <p>Manual review recommended. Commit changes and provenance data are soft flags, not final findings.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeNav === 'collaborators' && (
            <div className="panel">
              <div className="panel-header">
                <h3>Collaborator requests</h3>
                <span className="muted">{requests.length} pending</span>
              </div>

              <div className="request-list">
                {requests.length === 0 ? (
                  <p className="empty-state">All collaborator requests have been resolved.</p>
                ) : (
                  requests.map((request) => (
                    <div key={request.id} className="request-row">
                      <div>
                        <strong>{request.student}</strong>
                        <p>{request.course} · {request.type}</p>
                      </div>
                      <div className="request-actions">
                        <button className="primary-button small" onClick={() => acceptRequest(request.id)}>Accept</button>
                        <button className="ghost-button small" onClick={() => declineRequest(request.id)}>Decline</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeNav === 'courses' && (
            <div className="panel">
              <div className="panel-header">
                <h3>Course roster</h3>
                <span className="muted">3 active courses</span>
              </div>
              <div className="course-grid">
                {['CS101', 'CS205', 'CS302'].map((course) => (
                  <div key={course} className="course-card">
                    <h4>{course}</h4>
                    <p>Introduction to Programming</p>
                    <small>25 students · 4 flagged</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeNav === 'flags' && (
            <div className="panel">
              <div className="panel-header">
                <h3>Flag summary</h3>
                <span className="muted">Human review required</span>
              </div>
              <div className="flag-list">
                <div className="flag-row"><span>High risk</span><strong>8</strong></div>
                <div className="flag-row"><span>Medium risk</span><strong>24</strong></div>
                <div className="flag-row"><span>Low risk</span><strong>110</strong></div>
              </div>
            </div>
          )}

          {activeNav === 'settings' && (
            <div className="profile-layout">
              <div className="panel">
                <div className="panel-header">
                  <h3>Account</h3>
                </div>
                <div className="settings-list">
                  <div><span>Instructor</span><strong>{user?.fullName}</strong></div>
                  <div><span>Department</span><strong>Computer Science</strong></div>
                  <div><span>Region</span><strong>USJR</strong></div>
                  <div><span>Security</span><strong>JWT + HTTPS</strong></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
