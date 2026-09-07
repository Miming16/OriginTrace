import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const STUDENT_HISTORY = [
  { id: 'cs302-p2', title: 'CS302 · Project 2', date: 'Today 10:30', device: 'PC-001', band: 'low', integrity: 94, structural: 9, byline: 'Python' },
  { id: 'cs101-lab5', title: 'CS101 · Lab 5', date: 'Yesterday 14:15', device: 'LAP-042', band: 'low', integrity: 96, structural: 6, byline: 'Python' },
  { id: 'cs205-a3', title: 'CS205 · Assignment 3', date: '2 days ago', device: 'PC-001', band: 'medium', integrity: 74, structural: 52, byline: 'JavaScript' },
];

const COURSE_ASSIGNMENTS = [
  { id: 'a1', name: 'Lab 4: Control Flow', band: 'low', status: 'checked', resultId: 'cs101-lab5', repo: 'cs101-labs', submitted: true },
  { id: 'a2', name: 'Portfolio Website', band: 'medium', status: 'checked', resultId: 'cs205-a3', repo: 'web-assign', submitted: true },
  { id: 'a3', name: 'Project 2', band: 'low', status: 'pending', resultId: null, repo: '', submitted: false },
  { id: 'a4', name: 'Final Reflection', band: null, status: 'pending', resultId: null, repo: '', submitted: false },
];

const RISK_META = {
  low: { badge: 'Low', cls: 'risk-low', bar: '#22c55e' },
  medium: { badge: 'Medium', cls: 'risk-medium', bar: '#f59e0b' },
  high: { badge: 'High', cls: 'risk-high', bar: '#ef4444' },
};

export default function StudentSelfCheck() {
  const { user, logout } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [repoUrl, setRepoUrl] = useState('');
  const [result, setResult] = useState(null);
  const [gitHubConnected, setGitHubConnected] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('CS101');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const remainingChecks = useMemo(() => 3 - (result && result.checksUsed ? result.checksUsed : 1), [result]);

  function runSelfCheck(e) {
    e.preventDefault();
    if (remainingChecks <= 0) return;
    setResult({ checking: true, band: null, checksUsed: 1 });

    setTimeout(() => {
      const band = ['low', 'medium', 'high'][Math.floor(Math.random() * 3)];
      setResult({ checking: false, band, checksUsed: 1 });
    }, 1500);
  }

  const studentStats = [
    { label: 'Total submissions', value: '12', icon: 'description' },
    { label: 'Low risk', value: '8', icon: 'check_circle' },
    { label: 'Self-checks left', value: String(Math.max(0, remainingChecks)), icon: 'shield' },
    { label: 'Linked repos', value: '3', icon: 'link' },
  ];

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { key: 'courses', label: 'Courses', icon: 'school' },
    { key: 'history', label: 'History', icon: 'history' },
    { key: 'profile', label: 'Profile & Settings', icon: 'account_circle' },
  ];

  function renderDashboard() {
    return (
      <>
        <div className="stats-grid">
          {studentStats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className="stat-topline">
                <span className="material-symbols-outlined">{stat.icon}</span>
                <span>{stat.label}</span>
              </div>
              <h3>{stat.value}</h3>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Submission health</h3>
          </div>
          <div className="submission-panel-grid">
            <div className="chart-card">
              <div className="mini-chart">
                <span style={{ height: '48%' }} />
                <span style={{ height: '74%' }} />
                <span style={{ height: '62%' }} />
                <span style={{ height: '90%' }} />
                <span style={{ height: '68%' }} />
                <span style={{ height: '100%' }} />
              </div>
            </div>
            <div className="meta-card">
              <h4>Development plausibility</h4>
              <p>Most recent checks show steady commit growth with no undeclared device jumps.</p>
              <ul>
                <li>8 commits over 4 days</li>
                <li>Author-committer match: 100%</li>
                <li>No force-push detected</li>
              </ul>
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderCourses() {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>My courses</h3>
        </div>

        <div className="course-selector-row">
          {['CS101', 'CS205', 'CS302'].map((course) => (
            <button
              key={course}
              className={selectedCourse === course ? 'course-chip active' : 'course-chip'}
              onClick={() => setSelectedCourse(course)}
            >
              {course}
            </button>
          ))}
        </div>

        <div className="assignment-list">
          {COURSE_ASSIGNMENTS.map((assignment) => (
            <div key={assignment.id} className="assignment-item">
              <div>
                <h4>{assignment.name}</h4>
                <p>{assignment.repo ? `Repo: ${assignment.repo}` : 'No repository selected yet'}</p>
              </div>
              <div className="assignment-actions">
                <span className={assignment.band ? `risk-badge ${RISK_META[assignment.band].cls}` : 'risk-badge neutral'}>
                  {assignment.band ? RISK_META[assignment.band].badge : 'Not checked'}
                </span>
                <button className="ghost-button" onClick={() => setActiveView('dashboard')}>Open</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderHistory() {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>History</h3>
        </div>

        <div className="history-list">
          {STUDENT_HISTORY.map((entry) => (
            <div key={entry.id} className="history-item">
              <div>
                <h4>{entry.title}</h4>
                <p>{entry.date} · {entry.device} · {entry.byline}</p>
              </div>
              <div className="history-meta">
                <span className={`risk-badge ${RISK_META[entry.band].cls}`}>{RISK_META[entry.band].badge}</span>
                <button className="ghost-button" onClick={() => setResult({ checking: false, band: entry.band, checksUsed: 1 })}>View</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderProfile() {
    return (
      <div className="profile-layout">
        <div className="panel">
          <div className="panel-header">
            <h3>Repository access</h3>
          </div>

          <div className="github-card">
            <div className="github-title-row">
              <span className="material-symbols-outlined">sync</span>
              <strong>GitHub</strong>
            </div>
            <p>{gitHubConnected ? 'Connected as @alexadams-dev' : 'Not connected yet'}</p>
            <button className="primary-button" onClick={() => setGitHubConnected((value) => !value)}>
              {gitHubConnected ? 'Disconnect' : 'Connect account'}
            </button>
          </div>

          <div className="repo-input-box">
            <label>Git repo URL</label>
            <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/..." />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Account settings</h3>
          </div>
          <div className="settings-list">
            <div><span>Name</span><strong>{user?.fullName}</strong></div>
            <div><span>Role</span><strong>Student</strong></div>
            <div><span>Institution</span><strong>USJR</strong></div>
            <div><span>Self-check quota</span><strong>3 / week</strong></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isSidebarCollapsed ? 'app-layout sidebar-collapsed' : 'app-layout'}>
      <aside className="sidebar">
        <button type="button" className="brand-toggle" onClick={() => setIsSidebarCollapsed((value) => !value)} aria-label="Toggle sidebar">
          <img src="/origintrace-logo.svg" alt="OriginTrace logo" className="brand-logo mini-logo" />
          <span className="brand-text">OriginTrace</span>
        </button>

        <nav className="nav-group">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={activeView === item.key ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveView(item.key)}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>{user?.fullName || 'Student'}</span>
          <button className="logout-link" onClick={logout}>Logout</button>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <h2>{activeView === 'dashboard' ? 'Student Dashboard' : activeView === 'courses' ? 'My Courses' : activeView === 'history' ? 'History' : 'Profile & Settings'}</h2>
          <div className="topbar-tools">
            <span className="role-pill">Student</span>
            <div className="avatar-circle">AA</div>
          </div>
        </header>

        <div className="content-wrap">
          {activeView === 'dashboard' && renderDashboard()}
          {activeView === 'courses' && renderCourses()}
          {activeView === 'history' && renderHistory()}
          {activeView === 'profile' && renderProfile()}

          <div className="panel self-check-panel">
            <div className="panel-header">
              <h3>Self-check submission</h3>
              <span className="muted">{Math.max(0, 3 - (result?.checksUsed || 0))} of 3 remaining</span>
            </div>

            <form onSubmit={runSelfCheck} className="self-check-form">
              <label>Git repository</label>
              <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/your-org/project" />
              <div className="or-divider">or</div>
              <label className="upload-box">
                <input type="file" />
                <span>Drop file / browse to upload</span>
              </label>
              <button type="submit" className="primary-button" disabled={result?.checking}>
                {result?.checking ? 'Analyzing…' : 'Run self-check'}
              </button>
            </form>

            <div className="result-box">
              {!result ? (
                <p>No submission yet.</p>
              ) : result.checking ? (
                <p>Processing your repository...</p>
              ) : (
                <>
                  <span className={`risk-badge ${RISK_META[result.band].cls}`}>{RISK_META[result.band].badge}</span>
                  <p className="result-copy">
                    This aggregate band is derived from structure, commit history, and provenance signals.
                    Soft flags are surfaced to students, while faculty decisions remain human-reviewed.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
