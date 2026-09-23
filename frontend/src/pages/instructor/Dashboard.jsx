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

  const [submissions, setSubmissions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showCollaboratorRequestsPage, setShowCollaboratorRequestsPage] = useState(false);
  const [showNewAssignmentPage, setShowNewAssignmentPage] = useState(false);
  const [courseAssignments, setCourseAssignments] = useState(DEFAULT_COURSE_CONTENT.assignments);
  const [collaboratorRequests, setCollaboratorRequests] = useState(DEFAULT_COLLABORATOR_REQUESTS);
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [submissionCourseFilter, setSubmissionCourseFilter] = useState('all');
  const [submissionAssignmentFilter, setSubmissionAssignmentFilter] = useState('all');
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
      setSubmissions(data.map((submission) => {
        const riskBand = submission.risk || submission.risk_band || 'low';
        const assignment = submission.assignment || submission.assignment_name || submission.assignment_title || '';

        return {
          ...submission,
          course: submission.course || submission.subject_code || 'Unknown course',
          assignment,
          submittedDate: submission.submittedDate || submission.submitted_at,
          lang: submission.lang || submission.language,
          risk: riskBand.charAt(0).toUpperCase() + riskBand.slice(1).toLowerCase(),
        };
      }));
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

  const submissionCourseOptions = [...new Set(submissions.map((submission) => submission.course).filter(Boolean))].sort();
  const submissionAssignmentOptions = [...new Set(
    submissions.map((submission) => submission.assignment || 'Unassigned'),
  )].sort();
  const visibleSubmissions = submissions
    .filter((submission) => (
      submissionCourseFilter === 'all' || submission.course === submissionCourseFilter
    ))
    .filter((submission) => (
      submissionAssignmentFilter === 'all'
      || (submission.assignment || 'Unassigned') === submissionAssignmentFilter
    ))
    .sort((first, second) => new Date(second.submittedDate || 0) - new Date(first.submittedDate || 0));
  const selected = visibleSubmissions.find((s) => s.id === selectedId);

  const lowCount = submissions.filter((s) => s.risk === 'Low').length;
  const mediumCount = submissions.filter((s) => s.risk === 'Medium').length;
  const highCount = submissions.filter((s) => s.risk === 'High').length;

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
  const orderedAssignments = [...courseAssignments].sort(
    (first, second) => new Date(first.createdAt) - new Date(second.createdAt),
  );
  const orderedSubmissionActivity = selectedAssignment
    ? [...(selectedAssignment.submissions || [])].sort(
        (first, second) => new Date(first.submittedAt) - new Date(second.submittedAt),
      )
    : [];

  function handleCollaboratorRequest(requestId) {
    setCollaboratorRequests((current) => ({
      ...current,
      [selectedCourse.id]: (current[selectedCourse.id] || []).filter((request) => request.id !== requestId),
    }));
  }

  function handleCreateAssignment(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get('title') || '').trim();
    const deadline = String(formData.get('deadline') || '').trim();

    setCourseAssignments((current) => [
      ...current,
      {
        id: `assignment-${Date.now()}`,
        title,
        due: deadline ? `Due ${deadline}` : 'No deadline',
        status: '0 submissions',
        createdAt: new Date().toISOString(),
        submissions: [],
      },
    ]);
    setShowNewAssignmentPage(false);
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
                  <span className="muted">{visibleSubmissions.length} shown</span>
                </div>

                <div className="request-filter-bar submission-filter-bar">
                  <label htmlFor="submission-course-filter">Course</label>
                  <select
                    id="submission-course-filter"
                    value={submissionCourseFilter}
                    onChange={(event) => setSubmissionCourseFilter(event.target.value)}
                  >
                    <option value="all">All courses</option>
                    {submissionCourseOptions.map((course) => (
                      <option key={course} value={course}>{course}</option>
                    ))}
                  </select>

                  <label htmlFor="submission-assignment-filter">Assignment</label>
                  <select
                    id="submission-assignment-filter"
                    value={submissionAssignmentFilter}
                    onChange={(event) => setSubmissionAssignmentFilter(event.target.value)}
                  >
                    <option value="all">All assignments</option>
                    {submissionAssignmentOptions.map((assignment) => (
                      <option key={assignment} value={assignment}>{assignment}</option>
                    ))}
                  </select>
                </div>

                {loading ? (
                  <p className="loading-state">Loading submissions...</p>
                ) : visibleSubmissions.length === 0 ? (
                  <p className="empty-state">No submissions found.</p>
                ) : (
                  <div className="submission-table">
                    {visibleSubmissions.map((s) => (
                      <div
                        key={s.id}
                        className={selectedId === s.id ? 'submission-row active' : 'submission-row'}
                        onClick={() => setSelectedId(s.id)}
                      >
                        <div>
                          <strong>{s.student || s.name || s.studentName}</strong>
                          <p>
                            {s.course} · {s.assignment || 'Unassigned'} · Status: <em>{s.status || 'Submitted'}</em> · {s.submittedDate ? new Date(s.submittedDate).toLocaleString() : 'N/A'}
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

                {selected && (
                  <div className="detail-panel">
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
                )}
              </div>
            </>
          )}

          {activeNav === 'courses' && (
            <div className="panel">
              {!showCollaboratorRequestsPage && !showNewAssignmentPage ? (
                <div className="panel-header course-workspace-header">
                  <div className="course-page-title">
                    <span className="muted">Course workspace</span>
                    <h3>{selectedCourse?.subject_code || 'Course roster'}</h3>
                    {selectedCourse && <p>{selectedCourse.subject_title}</p>}
                  </div>
                  <div className="course-workspace-actions">
                    <button
                      type="button"
                      className="ghost-button small"
                      disabled={!selectedCourse}
                      onClick={() => setShowNewAssignmentPage(true)}
                    >
                      New Assignment
                    </button>
                    <button
                      type="button"
                      className="primary-button small add-collaborator-button"
                      disabled={!selectedCourse}
                      onClick={() => setShowCollaboratorRequestsPage(true)}
                    >
                      Collaborator Request
                    </button>
                  </div>
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
              ) : showNewAssignmentPage ? (
                <div className="new-assignment-page">
                  <div className="new-assignment-header">
                    <div>
                      <button
                        type="button"
                        className="back-link"
                        onClick={() => setShowNewAssignmentPage(false)}
                      >
                        <span className="material-symbols-outlined">arrow_back</span>
                        Back to course
                      </button>
                      <h3>New Assignment</h3>
                      <p>Students see the title, instructions, and deadline. Detection settings apply per assignment.</p>
                    </div>
                  </div>
                  <form className="new-assignment-form" onSubmit={handleCreateAssignment}>
                    <div className="assignment-form-grid course-points-row">
                      <label>
                        Course
                        <select name="course" defaultValue={selectedCourse?.id || ''}>
                          <option value={selectedCourse?.id || ''}>{selectedCourse?.subject_code} - {selectedCourse?.subject_title}</option>
                        </select>
                      </label>
                      <label>
                        Points
                        <input name="points" type="number" min="0" defaultValue="100" />
                      </label>
                    </div>
                    <label>
                      Title
                      <input name="title" required placeholder="e.g. Lab 7 - Classes & Objects" autoFocus />
                    </label>
                    <label>
                      Description / Instructions
                      <textarea name="description" rows="4" placeholder="What students need to build, constraints, grading notes..." />
                    </label>
                    <div className="assignment-form-grid deadline-row">
                      <label>
                        Deadline date
                        <input name="deadline" type="date" />
                      </label>
                      <label>
                        Deadline time
                        <input name="deadlineTime" type="time" defaultValue="23:59" />
                      </label>
                      <label>
                        Submission attempts
                        <select name="attempts" defaultValue="Unlimited">
                          <option>Unlimited</option>
                          <option>1</option>
                          <option>3</option>
                          <option>5</option>
                        </select>
                      </label>
                      <label>
                        Self-check limit
                        <select name="selfCheckLimit" defaultValue="Unlimited">
                          <option>Unlimited</option>
                          <option>1</option>
                          <option>3</option>
                          <option>5</option>
                        </select>
                      </label>
                    </div>
                    <p className="assignment-form-help">Submission attempts control how many times a student can resubmit before the deadline. Every self-check run is logged.</p>
                    <fieldset className="language-options">
                      <legend>Allowed languages</legend>
                      <label><input type="checkbox" name="languages" value="Python" defaultChecked /> Python</label>
                      <label><input type="checkbox" name="languages" value="Java" defaultChecked /> Java</label>
                      <label><input type="checkbox" name="languages" value="C" defaultChecked /> C</label>
                      <label><input type="checkbox" name="languages" value="PHP" defaultChecked /> PHP</label>
                    </fieldset>
                    <label className="late-submission-option"><input type="checkbox" name="acceptLate" /> Accept late submissions</label>
                    <div className="new-assignment-actions">
                      <button type="submit" className="primary-button">Create Assignment</button>
                      <button type="button" className="text-button" onClick={() => setShowNewAssignmentPage(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="course-overview">
                  <div className="course-overview-grid">
                    <section className="course-info-section">
                      {selectedAssignment ? (
                        <div className="assignment-detail-view">
                          <button
                            type="button"
                            className="back-link"
                            onClick={() => setSelectedAssignment(null)}
                          >
                            <span className="material-symbols-outlined">arrow_back</span>
                            Back to assignments
                          </button>
                          <div className="assignment-detail-heading">
                            <span className="muted">Assignment</span>
                            <h3>{selectedAssignment.title}</h3>
                            <p>Part of {selectedCourse?.subject_code} - {selectedCourse?.subject_title}</p>
                          </div>
                          <div className="assignment-detail-grid">
                            <div>
                              <span>Due date</span>
                              <strong>{selectedAssignment.due}</strong>
                            </div>
                            <div>
                              <span>Created</span>
                              <strong>{selectedAssignment.createdAt}</strong>
                            </div>
                            <div>
                              <span>Submissions</span>
                              <strong>{selectedAssignment.status}</strong>
                            </div>
                          </div>
                          <div className="submission-activity">
                            <div className="course-info-section-header">
                              <h3>Submitted by</h3>
                              <span className="muted">{orderedSubmissionActivity.length} shown</span>
                            </div>
                            <div className="submission-activity-list">
                              {orderedSubmissionActivity.map((submission) => (
                                <div key={`${selectedAssignment.id}-${submission.student}`} className="submission-activity-row">
                                  <strong>{submission.student}</strong>
                                  <span>{new Date(submission.submittedAt).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
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
                                onClick={() => setSelectedAssignment(assignment)}
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