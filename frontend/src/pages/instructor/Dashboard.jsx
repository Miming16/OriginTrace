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

const DEFAULT_COLLABORATOR_REQUESTS = {
  cs101: [
    { id: 'request-sarah', name: 'Sarah Connor', initials: 'SC', assignment: 'Lab 5', repository: 'github.com/sconnor/cs101-lab5', language: 'Python', invited: 'Invited 2h ago' },
    { id: 'request-james', name: 'James Reyes', initials: 'JR', assignment: 'Lab 4', repository: 'github.com/jreyes/cs101-lab4', language: 'C', invited: 'Invited 5h ago' },
  ],
};

const DEFAULT_SUBMISSION_ACTIVITY = [
  { student: 'Sarah Connor', submittedAt: '2026-09-20T08:15:00' },
  { student: 'James Reyes', submittedAt: '2026-09-20T10:40:00' },
  { student: 'Maya Santos', submittedAt: '2026-09-21T09:05:00' },
];

const DEFAULT_COURSE_CONTENT = {
  assignments: [
    { id: 'lab-1', title: 'Lab 1 - Programming Basics', due: 'Due Sep 20', status: '24 submissions', createdAt: '2026-09-01', submissions: DEFAULT_SUBMISSION_ACTIVITY },
    { id: 'lab-2', title: 'Lab 2 - Variables and Data Types', due: 'Due Sep 27', status: '22 submissions', createdAt: '2026-09-05', submissions: DEFAULT_SUBMISSION_ACTIVITY },
    { id: 'lab-3', title: 'Lab 3 - Functions', due: 'Due Oct 4', status: '20 submissions', createdAt: '2026-09-10', submissions: DEFAULT_SUBMISSION_ACTIVITY },
    { id: 'lab-4', title: 'Lab 4 - Control Flow', due: 'Due Oct 11', status: '18 submissions', createdAt: '2026-09-15', submissions: DEFAULT_SUBMISSION_ACTIVITY },
    { id: 'lab-5', title: 'Lab 5 - Functions and Modules', due: 'Due Oct 18', status: '12 submissions', createdAt: '2026-09-20', submissions: DEFAULT_SUBMISSION_ACTIVITY },
  ],
};

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
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [trackDevice, setTrackDevice] = useState(true);

  const [submissions, setSubmissions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedAssignmentSubmission, setSelectedAssignmentSubmission] = useState(null);
  const [showCollaboratorRequestsPage, setShowCollaboratorRequestsPage] = useState(false);
  const [collaboratorRequests, setCollaboratorRequests] = useState(DEFAULT_COLLABORATOR_REQUESTS);
  const [assignmentFilter, setAssignmentFilter] = useState('all');
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
      const res = await api.post(`/instructor/submissions/${selectedId}/decision`, { decision: status });
      const updatedStatus = res.data?.decision?.decision || status;

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
  const commitMetrics = detailData?.commit_metrics || detailData?.commit_signals?.[0] || null;

  const lowCount = submissions.filter((s) => s.risk_band === 'LOW').length;
  const mediumCount = submissions.filter((s) => s.risk_band === 'MEDIUM').length;
  const highCount = submissions.filter((s) => s.risk_band === 'HIGH').length;

  const kpis = [
    { label: 'Total submissions', value: submissions.length, badge: 'dashboard' },
    { label: 'High risk', value: highCount, badge: 'error' },
    { label: 'Medium risk', value: mediumCount, badge: 'warning' },
    { label: 'Low risk', value: lowCount, badge: 'check_circle' },
  ];

  const selectedCourseRequests = selectedCourse
    ? collaboratorRequests[selectedCourse.id] || []
    : [];
  const visibleCollaboratorRequests = assignmentFilter === 'all'
    ? selectedCourseRequests
    : selectedCourseRequests.filter((request) => request.assignment === assignmentFilter);
  const assignmentOptions = [...new Set(selectedCourseRequests.map((request) => request.assignment))];
  const orderedAssignments = [...DEFAULT_COURSE_CONTENT.assignments].sort(
    (first, second) => new Date(first.createdAt) - new Date(second.createdAt),
  );
  const orderedSubmissionActivity = selectedAssignment
    ? [...(selectedAssignment.submissions || [])].sort(
        (first, second) => new Date(first.submittedAt) - new Date(second.submittedAt),
      )
    : [];
  const isMediumResult = selectedAssignment?.id === 'lab-2' || selectedAssignment?.id === 'lab-4';
  const integrityScore = isMediumResult ? 74 : 96;
  const structuralScore = isMediumResult ? 52 : 6;
  const deduction = 100 - integrityScore;

  function handleCollaboratorRequest(requestId) {
    setCollaboratorRequests((current) => ({
      ...current,
      [selectedCourse.id]: (current[selectedCourse.id] || []).filter((request) => request.id !== requestId),
    }));
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
                    setShowCollaboratorRequestsPage(false);
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
              ? showCollaboratorRequestsPage
                ? 'Collaborator Requests'
                : 'Courses'
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
                          <span className={`risk-badge ${RISK_META[s.risk_band]?.cls || 'risk-low'}`}>
                            {s.risk_band}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!loading && submissions.length > 0 && !selected && (
                  <p className="empty-state">Select a submission from the table above to view detail analysis.</p>
                )}
              </div>

              {selected ? (
                <div className="panel detail-panel">
                  <div className="panel-header">
                    <h3>{selected.student || selected.name || selected.studentName}</h3>
                    <span className={`risk-badge ${RISK_META[selected.risk_band]?.cls || 'risk-low'}`}>
                      {selected.risk_band}
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
                          <span className={`risk-badge ${RISK_META[selected.risk_band]?.cls || 'risk-low'}`}>
                            {selected.risk_band}
                          </span>
                          <p>{detailData?.riskDescription || `Assigned ${selected.risk_band} risk level.`}</p>
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

                        <div className="detail-box">
                          <h4>Commit history</h4>
                          {commitMetrics ? (
                            <>
                              <p>
                                {commitMetrics.commit_count} commits over {commitMetrics.timespan_days} day(s).
                              </p>
                              <p>
                                Big-bang: {commitMetrics.has_big_bang ? 'Yes' : 'No'} · Low-entropy messages: {commitMetrics.low_entropy_count}
                              </p>
                              <p>Author/committer match: {commitMetrics.author_committer_match_pct}%</p>
                            </>
                          ) : (
                            <p>Commit metrics are not available for this submission.</p>
                          )}
                        </div>

                        <div className="detail-box emphasis">
                          <h4>Commit & Provenance flags</h4>
                          {detailData?.provenance_flags && detailData.provenance_flags.length > 0 ? (
                            <ul className="flags-list">
                              {detailData.provenance_flags.map((flag, idx) => (
                                <li key={idx}>
                                  <strong className={`flag-type ${flag.flag_level === 'HARD' ? 'hard-flag' : 'soft-flag'}`}>
                                    {flag.flag_level} flag:
                                  </strong>{' '}
                                  {flag.description}
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
                            onClick={() => handleDecision('cleared')}
                          >
                            Cleared
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={updatingDecision}
                            onClick={() => handleDecision('under_review')}
                          >
                            Under review
                          </button>
                          <button
                            type="button"
                            className="danger-button"
                            disabled={updatingDecision}
                            onClick={() => handleDecision('flagged')}
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
              ) : null}
            </>
          )}

          {activeNav === 'courses' && (
            <div className="panel">
              {!showCollaboratorRequestsPage ? (
                <div className="panel-header course-workspace-header">
                  <div className="course-page-title">
                    <span className="muted">Course workspace</span>
                    <h3>{selectedCourse?.subject_code || 'Course roster'}</h3>
                    {selectedCourse && <p>{selectedCourse.subject_title}</p>}
                  </div>
                  <button
                    type="button"
                    className="primary-button small add-collaborator-button"
                    disabled={!selectedCourse}
                    onClick={() => setShowCollaboratorRequestsPage(true)}
                  >
                    Collaborator Request
                  </button>
                </div>
              ) : null}
              {courses.length === 0 ? (
                <p className="empty-state">No courses are assigned to this instructor yet.</p>
              ) : showCollaboratorRequestsPage ? (
                <div className="collaborator-request-page">
                  <div className="collaborator-request-page-header">
                    <div className="course-breadcrumb" aria-label="Course navigation">
                      <button
                        type="button"
                        className="course-breadcrumb-course"
                        onClick={() => setShowCollaboratorRequestsPage(false)}
                      >
                        {selectedCourse.subject_code} - {selectedCourse.subject_title}
                      </button>
                      <span className="material-symbols-outlined course-breadcrumb-chevron">chevron_right</span>
                      <strong>Collaborator Requests</strong>
                    </div>
                  </div>

                  <div className="collaborator-request-list">
                    <div className="collaborator-request-course-header">
                      <strong>{selectedCourse.subject_code} - {selectedCourse.subject_title}</strong>
                      <span>{visibleCollaboratorRequests.length} pending</span>
                    </div>
                    <div className="request-filter-bar">
                      <label htmlFor="assignment-filter">Filter by assignment</label>
                      <select
                        id="assignment-filter"
                        value={assignmentFilter}
                        onChange={(event) => setAssignmentFilter(event.target.value)}
                      >
                        <option value="all">All assignments</option>
                        {assignmentOptions.map((assignment) => (
                          <option key={assignment} value={assignment}>{assignment}</option>
                        ))}
                      </select>
                    </div>
                    {visibleCollaboratorRequests.length === 0 ? (
                      <p className="empty-state collaborator-request-empty">No pending collaborator requests.</p>
                    ) : (
                      visibleCollaboratorRequests.map((request) => (
                        <div key={request.id} className="collaborator-request-row">
                          <div className="request-person">
                            <span className="request-avatar">{request.initials}</span>
                            <div>
                              <strong>{request.name}</strong>
                              <p>{request.assignment} - {request.repository}</p>
                              <div className="request-meta">
                                <span>{request.language}</span>
                                <small>{request.invited}</small>
                              </div>
                            </div>
                          </div>
                          <div className="request-actions">
                            <span className="pending-badge">Pending</span>
                            <button type="button" className="accept-button" onClick={() => handleCollaboratorRequest(request.id)}>Accept</button>
                            <button type="button" className="decline-button" onClick={() => handleCollaboratorRequest(request.id)}>Decline</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="course-overview">
                  <div className="course-overview-summary">
                    <div className="course-overview-info">
                      <span className="muted">Subject information</span>
                      <h3>{selectedCourse?.subject_code}</h3>
                      <p>{selectedCourse?.subject_title}</p>
                      <div className="course-detail-list">
                        <div><span>Instructor</span><strong>{user?.fullName || 'Assigned instructor'}</strong></div>
                        <div><span>Enrollment</span><strong>{selectedCourse?.enrolled_count || 0} students</strong></div>
                        <div><span>Availability</span><strong>{selectedCourse?.is_open ? 'Open' : 'Closed'}</strong></div>
                      </div>
                    </div>
                    <div className="course-overview-note">
                      <span className="material-symbols-outlined">school</span>
                      <strong>Course workspace</strong>
                      <p>Review course activity, assignments, and announcements from one place.</p>
                    </div>
                  </div>

                  <div className="course-overview-grid">
                    <section className="course-info-section">
                      {selectedAssignment ? (
                        selectedAssignmentSubmission ? (
                          <div className="student-assignment-detail">
                            <button type="button" className="back-link student-detail-back" onClick={() => setSelectedAssignmentSubmission(null)}>
                              <span className="material-symbols-outlined">arrow_back</span>
                              Back to submissions
                            </button>
                            <section className="panel assignment-detail-hero">
                              <div>
                                <h3>{selectedCourse?.subject_code} · {selectedAssignment.title}</h3>
                                <div className="assignment-detail-meta">
                                  <span>Python</span><span>PC-001</span><span>Checked Today 10:30</span>
                                </div>
                              </div>
                              <span className={`assignment-detail-risk ${isMediumResult ? 'medium-risk' : ''}`}><i style={{ background: isMediumResult ? '#f59e0b' : '#18bd5b' }} />{isMediumResult ? 'Medium' : 'Low'}</span>
                            </section>
                            <div className="assignment-detail-stats">
                              <div className="panel assignment-stat-card"><span>Integrity score</span><strong className={isMediumResult ? 'medium-value' : ''}>{integrityScore}%</strong><div className="integrity-bar"><i className={isMediumResult ? 'medium-bar' : ''} style={{ width: `${integrityScore}%` }} /></div></div>
                              <div className="panel assignment-stat-card"><span>Structural score</span><strong>{structuralScore}%</strong><small>Aggregate — no peer details</small></div>
                              <div className="panel assignment-stat-card"><span>Commit health</span><strong>{isMediumResult ? 'Variable' : 'Healthy'}</strong><small>{isMediumResult ? '8 commits · 2 days' : '9 commits · 3 days'}</small></div>
                              <div className="panel assignment-stat-card"><span>Flags</span><strong className={isMediumResult ? 'medium-value' : ''}>{isMediumResult ? '1' : '0'}</strong><small>{isMediumResult ? 'Advisory only' : 'All clear'}</small></div>
                            </div>
                            <section className="panel score-calculation-panel">
                              <h3><span className="material-symbols-outlined">calculate</span> How your {integrityScore}% is calculated</h3>
                              <p>Each detected signal deducts weighted points from a base score of 100. The deductions are added together and the total is converted into your integrity percentage.</p>
                              <div className="score-table"><div><strong>Base score</strong><strong>100</strong></div>{isMediumResult ? <><div><span>Structural similarity above threshold (52%)</span><b className="medium-value">−16</b></div><div><span>Low entropy commit messages</span><b className="medium-value">−6</b></div><div><span>Activity burst before deadline</span><b className="medium-value">−4</b></div></> : <div><span>Minor structural echoes (6% match)</span><b>−4</b></div>}<div><strong>Total deductions</strong><strong className={isMediumResult ? 'medium-value' : ''}>−{deduction}</strong></div></div>
                              <strong>Integrity score = 100 − {deduction} = <em className={isMediumResult ? 'medium-value' : ''}>{integrityScore}%</em></strong>
                            </section>
                            <div className="assignment-detail-bottom">
                              <section className="panel detail-info-panel"><h3 className={isMediumResult ? 'medium-heading' : ''}><span className="material-symbols-outlined">flag</span> Flags</h3>{isMediumResult ? <div className="warning-flag">▲ Low entropy commit messages — 3 commits with vague descriptions ("fix", "update")</div> : <div className="clear-flag"><span>✓</span> No flags detected</div>}</section>
                              <section className="panel detail-info-panel"><h3><span className="material-symbols-outlined">commit</span> Commit Summary</h3><div className="commit-summary">• {isMediumResult ? '8 commits over 2 days' : '9 commits over 3 days'}<br />{isMediumResult && <>• 1 burst of activity detected<br /></>}• No force-push detected<br />• Author-committer match: 100%</div></section>
                            </div>
                          </div>
                        ) : (
                          <div className="assignment-detail-view">
                            <button type="button" className="back-link" onClick={() => setSelectedAssignment(null)}>
                              <span className="material-symbols-outlined">arrow_back</span>
                              Back to assignments
                            </button>
                            <div className="assignment-detail-heading"><span className="muted">Assignment</span><h3>{selectedAssignment.title}</h3><p>Part of {selectedCourse?.subject_code} - {selectedCourse?.subject_title}</p></div>
                            <div className="assignment-detail-grid"><div><span>Due date</span><strong>{selectedAssignment.due}</strong></div><div><span>Created</span><strong>{selectedAssignment.createdAt}</strong></div><div><span>Submissions</span><strong>{selectedAssignment.status}</strong></div></div>
                            <div className="submission-activity"><div className="course-info-section-header"><h3>Submitted by</h3><span className="muted">{orderedSubmissionActivity.length} shown</span></div><div className="submission-activity-list">{orderedSubmissionActivity.map((submission) => <button type="button" key={`${selectedAssignment.id}-${submission.student}`} className="submission-activity-row" onClick={() => setSelectedAssignmentSubmission(submission)}><strong>{submission.student}</strong><span>{new Date(submission.submittedAt).toLocaleString()}</span></button>)}</div></div>
                          </div>
                        )
                      ) : (
                        <>
                          <div className="course-info-section-header">
                            <h3>Assignments</h3>
                            <span className="muted">{orderedAssignments.length} active</span>
                          </div>
                          <div className="course-item-list">
                            {orderedAssignments.map((assignment) => (
                              <button
                                type="button"
                                key={assignment.id}
                                className="course-item-row assignment-row"
                                onClick={() => {
                                  setSelectedAssignment(assignment);
                                  setSelectedAssignmentSubmission(null);
                                }}
                              >
                                <span className="assignment-row-content">
                                  <strong>{assignment.title}</strong>
                                  <span>{assignment.due}</span>
                                </span>
                                <span className="assignment-row-action">
                                  <small>{assignment.status}</small>
                                  <span className="material-symbols-outlined">chevron_right</span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </section>

                  </div>
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
            <div className="profile-settings-page">
              <div className="profile-settings-top">
                <section className="panel profile-card">
                  <div className="profile-avatar">{(user?.full_name || user?.fullName || 'DR').slice(0, 2).toUpperCase()}</div>
                  <h3>{user?.full_name || user?.fullName || 'Prof. Daniel Ramos'}</h3>
                  <p>Computer Science Department</p>
                  <span className="role-badge">Instructor</span>
                  <div className="profile-details">
                    <div><span>Employee no.</span><strong>{user?.id_number || 'FAC-0087'}</strong></div>
                    <div><span>Email</span><strong>{user?.email || 'd.ramos@university.edu'}</strong></div>
                    <div><span>Courses</span><strong>{courses.map((course) => course.subject_code).join(' · ') || 'CS101 · CS205 · CS302'}</strong></div>
                  </div>
                </section>

                <section className="panel connected-accounts-panel">
                  <div className="settings-panel-heading">
                    <h3>Connected Accounts</h3>
                    <p>Connect your GitHub account to accept student repository invites and review coursework repos.</p>
                  </div>
                  <div className="connected-account-row">
                    <div className="connected-account-name">
                      <span className="github-mark">●</span>
                      <div><strong>GitHub</strong><span>{isGitHubConnected ? 'Connected' : 'Not connected'}</span></div>
                    </div>
                    <button type="button" className="dark-button" onClick={() => setIsGitHubConnected((value) => !value)}>
                      {isGitHubConnected ? 'Disconnect GitHub' : 'Connect GitHub'}
                    </button>
                  </div>
                </section>
              </div>

              <div className="profile-settings-bottom">
                <section className="panel detection-panel">
                  <h3 className="settings-section-title">Detection Parameters</h3>
                  <div className="settings-field">
                    <label>Sensitivity</label>
                    <div className="fixed-setting"><strong>Always Maximum</strong><span>✓ Fixed</span></div>
                    <p>Detection always runs at full sensitivity — every signal is collected and scored. Flags remain advisory.</p>
                  </div>
                  <div className="settings-field">
                    <label htmlFor="risk-threshold">Risk Threshold</label>
                    <select id="risk-threshold" defaultValue="50"><option value="50">50% · Standard</option></select>
                  </div>
                  <div className="settings-field">
                    <label htmlFor="comparison-limit">Comparison Limit</label>
                    <select id="comparison-limit" defaultValue="250"><option value="250">250 submissions per batch</option></select>
                    <p>Estimated load time: ~12s for 250 submissions</p>
                  </div>
                  <div className="device-tracking-field">
                    <label htmlFor="device-tracking">Device Tracking</label>
                    <label className="checkbox-label"><input id="device-tracking" type="checkbox" checked={trackDevice} onChange={(event) => setTrackDevice(event.target.checked)} /> Track MAC addresses for provenance</label>
                    <p>Helps identify if code is written on multiple devices</p>
                  </div>
                </section>

                <section className="panel integrations-panel">
                  <h3 className="settings-section-title">Integrations</h3>
                  <div className="integration-row"><div><strong>Keystroke Extension</strong><span>Provenance metadata tracking</span></div><b>✓ Active</b></div>
                  <div className="integration-row"><div><strong>PostgreSQL</strong><span>Docker · Self-Hosted</span></div><b>✓ Online</b></div>
                  <div className="sync-status"><strong>▣ Sync Status</strong><span>Last sync: 2 minutes ago · 142 submissions indexed</span><div className="sync-bar"><i /></div></div>
                </section>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}