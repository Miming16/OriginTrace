import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function AdminPanel() {
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    try {
      setLoading(true);
      const [subjectsRes, studentsRes, enrollmentsRes] = await Promise.all([
        api.get('/subjects'),
        api.get('/users?role=student'),
        api.get('/enrollments'),
      ]);

      setSubjects(subjectsRes.data || []);
      setStudents(studentsRes.data || []);
      setEnrollments(enrollmentsRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load admin panel data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnroll(e) {
    e.preventDefault();
    if (!selectedSubject || !selectedStudent) return;

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await api.post('/enrollments', {
        subjectId: selectedSubject,
        studentId: selectedStudent,
      });

      setEnrollments((prev) => [...prev, res.data]);
      setSuccess('Student successfully enrolled!');
      setSelectedSubject('');
      setSelectedStudent('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to enroll student.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-panel">
      <h2>Admin Panel — Student Enrollment</h2>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <form onSubmit={handleEnroll} className="enrollment-form">
        <div className="form-group">
          <label htmlFor="subject-select">Select Subject</label>
          <select
            id="subject-select"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            required
            disabled={submitting || loading}
          >
            <option value="">-- Choose Subject --</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.code} - {sub.title}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="student-select">Select Student</label>
          <select
            id="student-select"
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            required
            disabled={submitting || loading}
          >
            <option value="">-- Choose Student --</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.fullName} ({student.email})
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={submitting || loading}>
          {submitting ? 'Enrolling...' : 'Enroll Student'}
        </button>
      </form>

      <h3>Current Enrollments</h3>
      {loading ? (
        <p>Loading enrollments...</p>
      ) : enrollments.length === 0 ? (
        <p className="empty-state">No enrollments yet.</p>
      ) : (
        <table className="enrollments-table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Email</th>
              <th>Subject</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((item) => (
              <tr key={item.id}>
                <td>{item.student?.fullName || item.studentName || item.studentId}</td>
                <td>{item.student?.email || item.studentEmail || 'N/A'}</td>
                <td>{item.subject?.code ? `${item.subject.code} - ${item.subject.title}` : item.subjectId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}