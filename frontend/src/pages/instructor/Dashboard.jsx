import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'courses', label: 'Courses', icon: 'school' },
  { key: 'flags', label: 'Flags', icon: 'flag' },
  { key: 'settings', label: 'Profile & Settings', icon: 'settings' },
];

const DEFAULT_COURSES = [
  { id: 'cs101', subject_code: 'CS101', subject_title: 'Introduction to Programming', enrolled_count: 0, is_open: true },
  { id: 'cs205', subject_code: 'CS205', subject_title: 'Introduction to Programming', enrolled_count: 0, is_open: true },
  { id: 'cs302', subject_code: 'CS302', subject_title: 'Introduction to Programming', enrolled_count: 0, is_open: true },
];

const RISK_META = {
  Low: { cls: 'risk-low', text: 'text-risk-low' },
  Medium: { cls: 'risk-medium', text: 'text-risk-medium' },
  High: { cls: 'risk-high', text: 'text-risk-high' },
};

export default function InstructorDashboard() {
  const { user, logout } = useAuth();
  const [activeNav, setActiveNav] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCourseMenuOpen, setIsCourseMenuOpen] = useState(false);

  const [submissions, setSubmissions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showCollaboratorForm, setShowCollaboratorForm] = useState(false);
  const [collaboratorName, setCollaboratorName] = useState('');
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [courseCollaborators, setCourseCollaborators] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [updatingDecision, setUpdatingDecision] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSubmissions();
    fetchCourses();
  }, []);

  async function fetchCourses() {
    try {
      const res = await api.get('/instructor/subjects');
      const assignedCourses = res.data?.subjects || [];
      const availableCourses = assignedCourses.length > 0 ? assignedCourses : DEFAULT_COURSES;
      setCourses(availableCourses);
      setSelectedCourse(availableCourses[0] || null);
    } catch (err) {
      setCourses(DEFAULT_COURSES);
      setSelectedCourse(DEFAULT_COURSES[0]);
      setError(err.response?.data?.message || 'Failed to load assigned courses.');
    }
  }

  async function fetchSubmissions() {
    try {
      setLoading(true);
      const res = await api.get('/instructor/submissions');
      const data = res.data?.submissions || [];
      setSubmissions(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch submissions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedId) {
      setDetailData(null);
      return;
    }

    async function fetchSubmissionDetail() {
      try {
        setLoadingDetail(true);
        const res = await api.get(`/instructor/submissions/${selectedId}`);
        setDetailData(res.data);
      } catch (err) {
        console.error('Failed to load submission detail:', err);
      } finally {
        setLoadingDetail(false);
      }
    }

    fetchSubmissionDetail();
  }, [selectedId]);

  async function handleDecision(status) {
    if (!selectedId) return;

    setUpdatingDecision(true);
    try {
      const res = await api.patch(`/instructor/submissions/${selectedId}`, { status });
      const updatedStatus = res.data?.status || status;

      setSubmissions((prev) =>
        prev.map((sub) => (sub.id === selectedId ? { ...sub, status: updatedStatus } : sub))
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update submission status.');
    } finally {
      setUpdatingDecision(false);
    }
  }

  const selected = submissions.find((s) => s.id === selectedId);

  const lowCount = submissions.filter((s) => s.risk === 'Low').length;
  const mediumCount = submissions.filter((s) => s.risk === 'Medium').length;
  const highCount = submissions.filter((s) => s.risk === 'High').length;

  const kpis = [
    { label: 'Total submissions', value: submissions.length, badge: 'dashboard' },
    { label: 'High risk', value: highCount, badge: 'error' },
    { label: 'Medium risk', value: mediumCount, badge: 'warning' },
    { label: 'Low risk', value: lowCount, badge: 'check_circle' },
  ];

  function handleAddCollaborator(event) {
    event.preventDefault();

    const name = collaboratorName.trim();
    const email = collaboratorEmail.trim();
    if (!name || !email) return;

    setCourseCollaborators((current) => ({
      ...current,
      [selectedCourse.id]: [...(current[selectedCourse.id] || []), { id: Date.now(), name, email }],
    }));
    setCollaboratorName('');
    setCollaboratorEmail('');
    setShowCollaboratorForm(false);
  }

  return (
    <div className={isSidebarCollapsed ? 'app-layout sidebar-collapsed' : 'app-layout'}>
      <aside className="sidebar">
        <button type="button" className="brand-toggle" onClick={() => setIsSidebarCollapsed((value) => !value)} aria-label="Toggle sidebar">
          <img src="/origintrace-logo-home.png" alt="OriginTrace logo" className="brand-logo mini-logo" />
          <span className="brand-text">OriginTrace</span>
        </button>

        <nav className="nav-group">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={activeNav === item.key ? 'nav-item active' : 'nav-item'}
              onClick={() => {
                setActiveNav(item.key);
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
          <span>{user?.fullName || 'Instructor'}</span>
          <button className="logout-link" onClick={logout}>Logout</button>
        </div>
      </aside>

      {activeNav === 'courses' && isCourseMenuOpen && (
        <aside className="course-menu-panel">
          <div className="course-menu-header">
            <span className="muted">Instructor workspace</span>
            <h3>Assigned courses</h3>
          </div>
          {courses.length === 0 ? (
            <p className="empty-state">No assigned courses.</p>
          ) : (
            <nav className="assigned-course-list" aria-label="Assigned courses">
              {courses.map((course) => (
                <button
                  type="button"
                  key={course.id}
                  className={selectedCourse?.id === course.id ? 'assigned-course active' : 'assigned-course'}
                  onClick={() => {
                    setSelectedCourse(course);
                    setIsCourseMenuOpen(false);
                  }}
                >
                  <strong>{course.subject_code}</strong>
                  <span>{course.subject_title}</span>
                </button>
              ))}
            </nav>
          )}
        </aside>
      )}

      <main className="main-shell">
        <header className="topbar">
          <h2>
            {activeNav === 'dashboard'
              ? 'Instructor Dashboard'
              : activeNav === 'courses'
              ? 'Courses'
              : activeNav === 'flags'
              ? 'Flags'
              : 'Profile & Settings'}
          </h2>
          <div className="topbar-tools">
            <span className="role-pill">Instructor</span>
            <div className="avatar-circle">PR</div>
          </div>
        </header>

        <div className="content-wrap">
          {activeNav === 'dashboard' && (
            <>
              {error && <div className="error-banner">{error}</div>}

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
                  <span className="muted">{submissions.length} shown</span>
                </div>

                {loading ? (
                  <p className="loading-state">Loading submissions...</p>
                ) : submissions.length === 0 ? (
                  <p className="empty-state">No submissions found.</p>
                ) : (
                  <div className="submission-table">
                    {submissions.map((s) => (
                      <div
                        key={s.id}
                        className={selectedId === s.id ? 'submission-row active' : 'submission-row'}
                        onClick={() => setSelectedId(s.id)}
                      >
                        <div>
                          <strong>{s.student || s.name || s.studentName}</strong>
                          <p>
                            {s.subject || s.course} · Status: <em>{s.status || 'Submitted'}</em> · {s.submittedDate || s.time || 'N/A'}
                          </p>
                        </div>
                        <div className="submission-row-meta">
                          {s.lang && <span className="lang-pill">{s.lang}</span>}
                          {s.flagsCount !== undefined && <span className="flag-pill">{s.flagsCount} flags</span>}
                          <span className={`risk-badge ${RISK_META[s.risk]?.cls || 'risk-low'}`}>
                            {s.risk}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selected ? (
                <div className="panel detail-panel">
                  <div className="panel-header">
                    <h3>{selected.student || selected.name || selected.studentName}</h3>
                    <span className={`risk-badge ${RISK_META[selected.risk]?.cls || 'risk-low'}`}>
                      {selected.risk}
                    </span>
                  </div>

                  {loadingDetail ? (
                    <p className="loading-state">Loading submission detail...</p>
                  ) : (
                    <>
                      <div className="detail-grid">
                        {/* 1. Risk Band */}
                        <div className="detail-box">
                          <h4>Risk band</h4>
                          <span className={`risk-badge ${RISK_META[selected.risk]?.cls || 'risk-low'}`}>
                            {selected.risk}
                          </span>
                          <p>{detailData?.riskDescription || `Assigned ${selected.risk} risk level.`}</p>
                        </div>

                        <div className="detail-box">
                          <h4>Matched fragments</h4>
                          <p>
                            {detailData?.matchedFragments ||
                              `Similarity cluster includes structural overlap across code segments.`}
                          </p>
                        </div>

                        <div className="detail-box">
                          <h4>Peer overlaps</h4>
                          <p>
                            {detailData?.peerOverlaps ||
                              `Matched against ${detailData?.peerCount || 0} peer submission(s).`}
                          </p>
                        </div>

                        <div className="detail-box emphasis">
                          <h4>Commit & Provenance flags</h4>
                          {detailData?.flags && detailData.flags.length > 0 ? (
                            <ul className="flags-list">
                              {detailData.flags.map((flag, idx) => (
                                <li key={idx}>
                                  <strong className={`flag-type ${flag.type === 'hard' ? 'hard-flag' : 'soft-flag'}`}>
                                    {flag.type === 'hard' ? 'hard flag' : 'soft flag'}:
                                  </strong>{' '}
                                  {flag.message}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>
                              <span className="soft-flag">soft flag</span>: Minor commit variances observed.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Decision Buttons Section */}
                      <div className="decision-section" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #eaecf0' }}>
                        <div className="decision-buttons" style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem' }}>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={updatingDecision}
                            onClick={() => handleDecision('Cleared')}
                          >
                            Cleared
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={updatingDecision}
                            onClick={() => handleDecision('Under review')}
                          >
                            Under review
                          </button>
                          <button
                            type="button"
                            className="danger-button"
                            disabled={updatingDecision}
                            onClick={() => handleDecision('Flagged')}
                          >
                            Flagged
                          </button>
                        </div>
                        <p className="fairness-note" style={{ fontSize: '0.875rem', color: '#667085', italic: 'true' }}>
                          <em>OriginTrace flags submissions for review. The final call is yours.</em>
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="panel detail-panel empty-detail">
                  <p className="empty-state">Select a submission from the table above to view detail analysis.</p>
                </div>
              )}
            </>
          )}

          {activeNav === 'courses' && (
            <div className="panel">
              <div className="panel-header">
                <h3>Course roster</h3>
                <button
                  type="button"
                  className="primary-button small add-collaborator-button"
                  disabled={!selectedCourse}
                  onClick={() => setShowCollaboratorForm((value) => !value)}
                >
                  Add Collaborator +
                </button>
              </div>
              {courses.length === 0 ? (
                <p className="empty-state">No courses are assigned to this instructor yet.</p>
              ) : (
                <div className="course-roster-layout">
                  <div className="course-grid">
                    {courses.map((course) => (
                      <button
                        type="button"
                        key={course.id}
                        className={selectedCourse?.id === course.id ? 'course-card selected' : 'course-card'}
                        onClick={() => setSelectedCourse(course)}
                      >
                        <h4>{course.subject_code}</h4>
                        <p>{course.subject_title}</p>
                        <small>{course.enrolled_count || 0} enrolled</small>
                      </button>
                    ))}
                  </div>

                  {selectedCourse && <aside className="course-side-panel">
                    <div className="course-side-panel-header">
                      <div>
                        <span className="muted">Assigned course</span>
                        <h3>{selectedCourse.subject_code}</h3>
                      </div>
                      <button
                        type="button"
                        className="close-panel-button"
                        onClick={() => setSelectedCourse(null)}
                        aria-label="Close course details"
                      >
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>

                    <div className="course-detail-list">
                      <div><span>Course title</span><strong>{selectedCourse.subject_title}</strong></div>
                      <div><span>Instructor</span><strong>{user?.fullName || 'Assigned instructor'}</strong></div>
                      <div><span>Enrollment</span><strong>{selectedCourse.enrolled_count || 0} students</strong></div>
                      <div><span>Availability</span><strong>{selectedCourse.is_open ? 'Open' : 'Closed'}</strong></div>
                    </div>

                    <div className="course-collaborators">
                <div className="course-collaborators-header">
                  <div>
                    <h3>Collaborators</h3>
                    <p className="muted">People who can help review this course.</p>
                  </div>
                  <span className="muted">{(courseCollaborators[selectedCourse.id] || []).length} added</span>
                </div>

                {showCollaboratorForm && (
                  <form className="collaborator-form" onSubmit={handleAddCollaborator}>
                    <label>
                      Name
                      <input
                        type="text"
                        value={collaboratorName}
                        onChange={(event) => setCollaboratorName(event.target.value)}
                        placeholder="Collaborator name"
                        required
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={collaboratorEmail}
                        onChange={(event) => setCollaboratorEmail(event.target.value)}
                        placeholder="name@school.edu"
                        required
                      />
                    </label>
                    <div className="collaborator-form-actions">
                      <button type="submit" className="primary-button small">Add collaborator</button>
                      <button type="button" className="ghost-button small" onClick={() => setShowCollaboratorForm(false)}>Cancel</button>
                    </div>
                  </form>
                )}

                {(courseCollaborators[selectedCourse.id] || []).length === 0 ? (
                  <p className="empty-state">No collaborators added to this course yet.</p>
                ) : (
                  <div className="collaborator-list">
                    {courseCollaborators[selectedCourse.id].map((collaborator) => (
                      <div key={collaborator.id} className="collaborator-row">
                        <div>
                          <strong>{collaborator.name}</strong>
                          <p>{collaborator.email}</p>
                        </div>
                        <span className="status-pill">Active</span>
                      </div>
                    ))}
                  </div>
                )}
                    </div>
                  </aside>}
                </div>
              )}
            </div>
          )}

          {activeNav === 'flags' && (
            <div className="panel">
              <div className="panel-header">
                <h3>Flag summary</h3>
                <span className="muted">Human review required</span>
              </div>
              <div className="flag-list">
                <div className="flag-row"><span>High risk</span><strong>{highCount}</strong></div>
                <div className="flag-row"><span>Medium risk</span><strong>{mediumCount}</strong></div>
                <div className="flag-row"><span>Low risk</span><strong>{lowCount}</strong></div>
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