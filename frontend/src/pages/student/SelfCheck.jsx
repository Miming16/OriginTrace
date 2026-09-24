import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api, { analysisApi } from '../../api/axios';


const DEFAULT_STUDENT_SUBJECTS = [
  { id: 'cs101', subject_code: 'CS101', subject_title: 'Introduction to Programming', is_open: true },
  { id: 'cs205', subject_code: 'CS205', subject_title: 'Web Development', is_open: true },
  { id: 'cs302', subject_code: 'CS302', subject_title: 'Software Engineering', is_open: true },
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
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showSelfCheckForm, setShowSelfCheckForm] = useState(false);
  const [historyCourseFilter, setHistoryCourseFilter] = useState('all');
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState(null);
  const [quota, setQuota] = useState({ limit: 3, used: 0, remaining: 3 });
  const [history, setHistory] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId);
  const remainingChecks = quota.remaining;

  async function loadQuota(subjectId = selectedSubjectId) {
    if (!subjectId) return;

    try {
      const response = await api.get('/student/self-checks/quota', {
        params: { subject_id: subjectId },
      });
      setQuota(response.data);
    } catch (error) {
      setResult({ error: error.response?.data?.error || 'Failed to load your self-check quota.' });
    }
  }

    async function loadHistory() {
    try {
      const response = await api.get('/student/self-checks');
      setHistory((response.data.self_checks || []).map((check) => ({
        id: check.id,
        course: check.subject_code,
        title: `${check.subject_code} · ${check.subject_title}`,
        date: new Date(check.submitted_at).toLocaleString(),
        band: (check.risk_band || 'low').toLowerCase(),
        byline: check.language,
      })));
    } catch (error) {
      setResult({ error: error.response?.data?.error || 'Failed to load your self-check history.' });
    }
  }

  async function loadAssignments(subjectId = selectedSubjectId) {
    if (!subjectId) return;

    try {
      const response = await api.get(`/student/subjects/${subjectId}/assignments`);
      const mapped = (response.data.assignments || []).map((item) => ({
        id: item.id,
        name: item.title,
        detailName: item.title,
        due: item.due_at ? new Date(item.due_at).toLocaleString() : 'No deadline',
        instructions: item.instructions || 'No instructions provided.',
        selfChecks: item.self_checks,
        attempts: item.attempts,
        band: item.last_self_check_band ? item.last_self_check_band.toLowerCase() : null,
        status: item.attempts > 0 ? 'submitted' : item.self_checks > 0 ? 'checked' : 'pending',
        statusLabel: item.attempts > 0 ? 'Submitted' : item.self_checks > 0 ? 'Self-checked' : 'Not submitted',
        action: 'self-check',
      }));
      setAssignments(mapped);
      setSelectedAssignment((current) => (current ? mapped.find((item) => item.id === current.id) || null : null));
    } catch {
      setAssignments([]);
    }
  }

  useEffect(() => {
    async function loadSubjects() {
      try {
        const response = await api.get('/student/subjects');
        const availableSubjects = response.data.subjects?.length
          ? response.data.subjects
          : DEFAULT_STUDENT_SUBJECTS;
        setSubjects(availableSubjects);
        setSelectedSubjectId(availableSubjects[0]?.id || '');
      } catch (error) {
        setResult({ error: error.response?.data?.error || 'Failed to load your subjects.' });
      } finally {
        setLoadingSubjects(false);
      }
    }

    loadSubjects();
    loadHistory();
  }, []);

  useEffect(() => {
    if (!selectedSubjectId) return;

    loadQuota();
    loadAssignments();
  }, [selectedSubjectId]);

  async function runSelfCheck(e, isFinal = false) {
    e.preventDefault();
    if ((!isFinal && remainingChecks <= 0) || !selectedSubjectId || (!repoUrl && !selectedFile)) return;

    const formData = new FormData();
    formData.append('language', 'python');
    formData.append('is_self_check', isFinal ? 'false' : 'true');
    formData.append('subject_id', selectedSubjectId);
    if (selectedAssignment) formData.append('assignment_id', selectedAssignment.id);
    if (selectedFile) {
      formData.append('upload', selectedFile);
    } else {
      formData.append('source_url', repoUrl);
    }

    setResult({ checking: true, risk_band: null, checksUsed: 1 });
    try {
      const response = await analysisApi.post('/analyze', formData);
      setResult({ ...response.data, checking: false, checksUsed: 1 });
      await loadQuota();
      await loadHistory();
      await loadAssignments();
    } catch (error) {
      setResult({
        checking: false,
        error: error.response?.data?.detail || 'Submission failed.',
      });
    }
  }

  const studentStats = [
    { label: 'Total submissions', value: String(history.length), icon: 'description' },
    { label: 'Low risk', value: String(history.filter((entry) => entry.band === 'low').length), icon: 'check_circle' },
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
    const lastSubmission = history[0];
    const currentRisk = lastSubmission ? RISK_META[lastSubmission.band] : null;

    return (
      <>
        <div className="student-dashboard-stats">
          <div className="student-dashboard-card">
            <span className="student-card-label">Self-Checks Run</span>
            <strong>{history.length}</strong>
            <button type="button" className="dashboard-history-link" onClick={() => setActiveView('history')}>View history →</button>
          </div>
          <div className="student-dashboard-card">
            <span className="student-card-label">Last Submission</span>
            <strong>{lastSubmission ? lastSubmission.title : 'No self-checks yet'}</strong>
            <span className="student-card-meta">{lastSubmission?.date || '—'}</span>
          </div>
          <div className="student-dashboard-card">
            <span className="student-card-label">Current Risk Band</span>
            <strong className="student-risk-value"><i style={{ background: currentRisk?.bar }} />{currentRisk?.badge || '—'}</strong>
            <span className="student-card-meta">Latest self-check</span>
          </div>
          <div className="student-dashboard-card">
            <span className="student-card-label">Self-checks left today</span>
            <strong>{Math.max(0, remainingChecks)} of {quota.limit}</strong>
            <span className="student-card-meta">{selectedSubject?.subject_code || '—'}</span>
          </div>
        </div>

        <div className="panel recent-self-checks-panel">
          <div className="recent-self-checks-title">
            <h3><span className="material-symbols-outlined">assignment</span> Recent Self-Checks</h3>
          </div>
          <div className="recent-self-checks-list">
            {history.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="recent-self-check-row"
                onClick={() => {
                  setSelectedHistoryEntry(entry);
                  setActiveView('history');
                }}
              >
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
    const course = selectedSubject || DEFAULT_STUDENT_SUBJECTS[0];

    if (showSelfCheckForm) {
      return renderSelfCheckForm(course);
    }

    if (selectedAssignment) {
      return renderAssignmentDetail(selectedAssignment, course);
    }

    return (
      <div className="panel student-course-detail">
        <div className="student-course-detail-header">
          <div>
            <span className="student-course-eyebrow">Selected course</span>
            <h3>{course.subject_code} · {course.subject_title}</h3>
            <p>{course.is_open ? 'Open for submissions' : 'Closed for submissions'}</p>
          </div>
          <button type="button" className="switch-course-button" onClick={() => {
            setSelectedAssignment(null);
            setIsCourseMenuOpen(true);
          }}>
            <span className="material-symbols-outlined">swap_horiz</span>
            Switch Course
          </button>
        </div>

        <div className="student-assignment-section">
          <div className="student-assignment-heading">
            <strong>Assignments</strong>
            <span>{assignments.filter((item) => item.selfChecks > 0).length} of {assignments.length} self-checked · {assignments.filter((item) => item.attempts > 0).length} submitted</span>
          </div>
          {assignments.map((assignment) => (
            <button
              key={assignment.id}
              type="button"
              className="student-assignment-row"
              onClick={() => setSelectedAssignment(assignment)}
            >
              <div className="student-assignment-copy">
                <strong>{assignment.name}</strong>
                <span>Due {assignment.due} · <b className={assignment.status === 'submitted' || assignment.status === 'checked' ? 'submitted' : ''}>{assignment.statusLabel}</b></span>
              </div>
              <div className="student-assignment-actions">
                <span className={assignment.band ? `risk-badge ${RISK_META[assignment.band].cls}` : 'risk-badge neutral'}>
                  {assignment.band ? RISK_META[assignment.band].badge : 'Not checked'}
                </span>
                {assignment.action === 'checked' && <strong className="assignment-checked">✓ Checked</strong>}
                {assignment.action === 'result' && <span className="assignment-result-button">View result →</span>}
                {assignment.action === 'self-check' && <span className="run-self-check-button">Run Self-Check</span>}
              </div>
            </button>
          ))}
          {assignments.length === 0 && <p className="empty-state">No assignments in this course yet.</p>}
        </div>
        <p className="student-course-note">Run a self-check on each assignment before submitting. Press Courses in the sidebar (or Switch Course above) to open the course list.</p>
      </div>
    );
  }

  function renderSelfCheckForm(course) {
    return (
      <div className="panel student-self-check-page">
        <div className="student-self-check-header">
          <button type="button" className="back-link" onClick={() => setShowSelfCheckForm(false)}>
            <span className="material-symbols-outlined">arrow_back</span>
            Back to {course.subject_code}
          </button>
          <span className="student-self-check-remaining">{Math.max(0, remainingChecks)} of {quota.limit} remaining</span>
        </div>
        <h3>{selectedAssignment ? selectedAssignment.name : 'Self-check submission'}</h3>

        <form onSubmit={runSelfCheck} className="student-self-check-form">
          <label htmlFor="self-check-repository">Git repository</label>
          <input id="self-check-repository" value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/your-org/project" disabled={Boolean(selectedFile)} />
          <div className="student-self-check-or">or</div>
          <label className="student-upload-box">
            <input type="file" onChange={(event) => setSelectedFile(event.target.files[0] || null)} disabled={Boolean(repoUrl)} />
            <span>Drop file / browse to upload</span>
          </label>
          <button type="submit" className="student-run-check-button" disabled={result?.checking || loadingSubjects || !selectedSubject?.is_open || remainingChecks <= 0}>
            {result?.checking ? 'Analyzing...' : 'Run self-check'}
          </button>
          {selectedAssignment && (
            <button type="button" className="student-run-check-button" disabled={result?.checking || loadingSubjects || !selectedSubject?.is_open} onClick={(event) => runSelfCheck(event, true)}>
              Submit to instructor
            </button>
          )}
        </form>

        <div className="student-self-check-result">
          {!result ? (
            <p>No submission yet.</p>
          ) : result.checking ? (
            <p>Processing your repository...</p>
          ) : result.error ? (
            <p>{result.error}</p>
          ) : (
            <>
              <span className={`risk-badge ${RISK_META[result.risk_band?.toLowerCase()]?.cls || 'risk-low'}`}>{result.risk_band || 'LOW'}</span>
              <p>{result.guidance || 'This aggregate band is derived from structure, commit history, and provenance signals.'}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  function renderAssignmentDetail(assignment, course) {
    const risk = assignment.band ? RISK_META[assignment.band] : null;

    return (
      <div className="student-assignment-detail">
        <button type="button" className="back-link student-detail-back" onClick={() => setSelectedAssignment(null)}>
          <span className="material-symbols-outlined">arrow_back</span>
          Back to {course.subject_code}
        </button>

        <section className="panel assignment-detail-hero">
          <div>
            <h3>{course.subject_code} · {assignment.detailName}</h3>
            <div className="assignment-detail-meta">
              <span>Python</span><span>Due {assignment.due}</span><span>{assignment.statusLabel}</span>
            </div>
          </div>
          {risk
            ? <span className="assignment-detail-risk"><i style={{ background: risk.bar }} />{risk.badge}</span>
            : <span className="risk-badge neutral">Not checked</span>}
        </section>

        <section className="panel assignment-overview-panel">
          <h3><span className="material-symbols-outlined">description</span> Assignment details</h3>
          <p>{assignment.instructions}</p>
          <div className="assignment-overview-grid">
            <div><span>Deadline</span><strong>{assignment.due}</strong></div>
            <div><span>Self-checks</span><strong>{assignment.selfChecks}</strong></div>
            <div><span>Attempts</span><strong>{assignment.attempts}</strong></div>
          </div>
          {assignment.action === 'self-check' && (
            <button type="button" className="student-run-check-button assignment-run-check-button" onClick={() => setShowSelfCheckForm(true)}>
              Run self-check
            </button>
          )}
        </section>
      </div>
    );
  }

  function renderHistory() {
    if (selectedHistoryEntry) {
      return renderHistoryDetail(selectedHistoryEntry);
    }

    const visibleHistory = history.filter((entry) => (
      historyCourseFilter === 'all' || entry.course === historyCourseFilter
    ));

    return (
      <div className="panel">
        <div className="panel-header">
          <h3>History</h3>
          <div className="history-filter">
            <label htmlFor="history-course-filter">Course</label>
            <select id="history-course-filter" value={historyCourseFilter} onChange={(event) => setHistoryCourseFilter(event.target.value)}>
              <option value="all">All courses</option>
              {[...new Set(history.map((entry) => entry.course))].map((course) => (
                <option key={course} value={course}>{course}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="history-list">
          {visibleHistory.map((entry) => (
            <div key={entry.id} className="history-item">
              <div>
                <h4>{entry.title}</h4>
                <p>{entry.date} · {entry.device} · {entry.byline}</p>
              </div>
              <div className="history-meta">
                <span className={`risk-badge ${RISK_META[entry.band].cls}`}>{RISK_META[entry.band].badge}</span>
                <button type="button" className="ghost-button" onClick={() => setSelectedHistoryEntry(entry)}>View</button>
              </div>
            </div>
          ))}
          {visibleHistory.length === 0 && <p className="empty-state">No history found for this course.</p>}
        </div>
      </div>
    );
  }

  function renderHistoryDetail(entry) {
    const isMedium = entry.band === 'medium';
    const risk = RISK_META[entry.band];

    return (
      <div className="student-assignment-detail">
        <button
          type="button"
          className="back-link student-detail-back"
          onClick={() => {
            setSelectedHistoryEntry(null);
            setActiveView('dashboard');
          }}
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Back to Dashboard
        </button>

        <section className="panel assignment-detail-hero">
          <div>
            <h3>{entry.title}</h3>
            <div className="assignment-detail-meta">
              <span>{entry.byline}</span><span>{entry.device}</span><span>Checked {entry.date}</span>
            </div>
          </div>
          <span className={`assignment-detail-risk ${isMedium ? 'medium-risk' : ''}`}><i style={{ background: risk.bar }} />{risk.badge}</span>
        </section>
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
            <div><span>Name</span><strong>{user?.full_name}</strong></div>
            <div><span>Role</span><strong>Student</strong></div>
            <div><span>Institution</span><strong>USJR</strong></div>
            <div><span>Self-check quota</span><strong>{quota.limit} / day</strong></div>
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
          <span>{user?.full_name || 'Student'}</span>
          <button className="logout-link" onClick={logout}>Logout</button>
        </div>
      </aside>

      {activeView === 'courses' && isCourseMenuOpen && (
        <aside className="student-course-menu">
          <div className="student-course-menu-header">
            <div>
              <h3>Courses</h3>
              <p>Choose a course to open it</p>
            </div>
            <button type="button" className="student-course-menu-close" onClick={() => setIsCourseMenuOpen(false)} aria-label="Close courses menu">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          {subjects.length === 0 ? (
            <p className="empty-state">No courses are assigned yet.</p>
          ) : (
            <nav className="student-course-list" aria-label="My courses">
              {subjects.map((subject) => (
                <button
                  type="button"
                  key={subject.id}
                  className={selectedSubjectId === subject.id ? 'student-course-card active' : 'student-course-card'}
                  onClick={() => {
                    setSelectedSubjectId(subject.id);
                    setSelectedAssignment(null);
                    setIsCourseMenuOpen(false);
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
