import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api, { analysisApi } from '../../api/axios';

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
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [gitHubConnected, setGitHubConnected] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCourseMenuOpen, setIsCourseMenuOpen] = useState(false);

  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId);
  const remainingChecks = useMemo(() => 3 - (result?.checksUsed || 0), [result]);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const response = await api.get('/student/subjects');
        const availableSubjects = response.data.subjects || [];
        setSubjects(availableSubjects);
        setSelectedSubjectId(availableSubjects[0]?.id || '');
      } catch (error) {
        setResult({ error: error.response?.data?.error || 'Failed to load your subjects.' });
      } finally {
        setLoadingSubjects(false);
      }
    }

    loadSubjects();
  }, []);

  async function runSelfCheck(e) {
    e.preventDefault();
    if (remainingChecks <= 0 || !selectedSubjectId || (!repoUrl && !selectedFile)) return;

    const formData = new FormData();
    formData.append('language', 'python');
    formData.append('is_self_check', 'true');
    formData.append('subject_id', selectedSubjectId);
    if (selectedFile) {
      formData.append('upload', selectedFile);
    } else {
      formData.append('source_url', repoUrl);
    }

    setResult({ checking: true, band: null, checksUsed: 1 });
    try {
      const response = await analysisApi.post('/analyze', formData);
      setResult({ ...response.data, checking: false, checksUsed: 1 });
    } catch (error) {
      setResult({
        checking: false,
        error: error.response?.data?.detail || 'Submission failed.',
      });
    }
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
    const lastSubmission = STUDENT_HISTORY[0];
    const currentRisk = RISK_META[lastSubmission.band];

    return (
      <>
        <div className="student-dashboard-stats">
          <div className="student-dashboard-card">
            <span className="student-card-label">Self-Checks Run</span>
            <strong>12</strong>
            <button type="button" className="dashboard-history-link" onClick={() => setActiveView('history')}>View history →</button>
          </div>
          <div className="student-dashboard-card">
            <span className="student-card-label">Last Submission</span>
            <strong>{lastSubmission.title}</strong>
            <span className="student-card-meta">2 hours ago</span>
          </div>
          <div className="student-dashboard-card">
            <span className="student-card-label">Current Risk Band</span>
            <strong className="student-risk-value"><i style={{ background: currentRisk.bar }} />{currentRisk.badge}</strong>
            <span className="student-card-meta">No flags detected</span>
          </div>
          <div className="student-dashboard-card">
            <span className="student-card-label">Device</span>
            <strong>PC-001</strong>
            <span className="student-card-meta">MAC: 00:1A:2B:3C:4D:5E</span>
          </div>
        </div>

        <div className="panel recent-self-checks-panel">
          <div className="recent-self-checks-title">
            <h3><span className="material-symbols-outlined">assignment</span> Recent Self-Checks</h3>
          </div>
          <div className="recent-self-checks-list">
            {STUDENT_HISTORY.map((entry) => (
              <button key={entry.id} type="button" className="recent-self-check-row" onClick={() => setActiveView('history')}>
                <span>{entry.title}</span>
                <strong className={RISK_META[entry.band].cls}>{RISK_META[entry.band].badge}</strong>
                <time>{entry.date}</time>
              </button>
            ))}
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
          {subjects.map((subject) => (
            <button
              key={subject.id}
              className={selectedSubjectId === subject.id ? 'course-chip active' : 'course-chip'}
              onClick={() => setSelectedSubjectId(subject.id)}
            >
              {subject.subject_code}
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
          <img src="/origintrace-logo-home.png" alt="OriginTrace logo" className="brand-logo mini-logo" />
          <span className="brand-text">OriginTrace</span>
        </button>

        <nav className="nav-group">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={activeView === item.key ? 'nav-item active' : 'nav-item'}
              onClick={() => {
                setActiveView(item.key);
                if (item.key === 'courses') {
                  setIsCourseMenuOpen((value) => !value);
                } else {
                  setIsCourseMenuOpen(false);
                }
              }}
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

      {activeView === 'courses' && isCourseMenuOpen && (
        <aside className="course-menu-panel">
          <div className="course-menu-header">
            <span className="muted">Student workspace</span>
            <h3>My courses</h3>
          </div>
          {subjects.length === 0 ? (
            <p className="empty-state">No courses are assigned yet.</p>
          ) : (
            <nav className="assigned-course-list" aria-label="My courses">
              {subjects.map((subject) => (
                <button
                  type="button"
                  key={subject.id}
                  className={selectedSubjectId === subject.id ? 'assigned-course active' : 'assigned-course'}
                  onClick={() => {
                    setSelectedSubjectId(subject.id);
                  }}
                >
                  <strong>{subject.subject_code}</strong>
                  <span>{subject.subject_title}</span>
                </button>
              ))}
            </nav>
          )}
        </aside>
      )}

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
        </div>
      </main>
    </div>
  );
}
