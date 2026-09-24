import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [enrollments, setEnrollments] = useState([]);

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectTitle, setSubjectTitle] = useState('');

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
      const [subjectsRes, studentsRes, instructorsRes, enrollmentsRes] = await Promise.all([
        api.get('/admin/subjects'),
        api.get('/admin/students'),
        api.get('/admin/instructors'),
        api.get('/admin/enrollments'),
      ]);
      setSubjects(subjectsRes.data.subjects || []);
      setStudents(studentsRes.data.students || []);
      setInstructors(instructorsRes.data.instructors || []);
      setEnrollments(enrollmentsRes.data.enrollments || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load admin panel data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSubject(e) {
    e.preventDefault();
    if (!subjectCode || !subjectTitle || !selectedInstructor) return;

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await api.post('/admin/subjects', {
        subject_code: subjectCode,
        subject_title: subjectTitle,
        instructor_id: selectedInstructor,
      });
      setSubjects((prev) => [...prev, res.data.subject]);
      setSubjectCode('');
      setSubjectTitle('');
      setSelectedInstructor('');
      setSuccess('Subject created and assigned to the instructor.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create subject.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEnroll(e) {
    e.preventDefault();
    if (!selectedSubject || !selectedStudent) return;

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await api.post(`/admin/subjects/${selectedSubject}/enrollments`, {
        student_id: selectedStudent,
      });
      const subject = subjects.find((item) => item.id === selectedSubject);
      const student = students.find((item) => item.id === selectedStudent);
      setEnrollments((prev) => [
        {
          ...res.data.enrollment,
          subject_id: subject.id,
          subject_code: subject.subject_code,
          subject_title: subject.subject_title,
          student_id: student.id,
          student_name: student.full_name,
          student_email: student.email,
        },
        ...prev,
      ]);
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
    <div className="min-h-screen bg-background text-primary">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-standard bg-white">
        <span className="font-bold text-lg flex items-center gap-2">
          <img src="/origintrace-logo-home.png" alt="OriginTrace logo" className="brand-logo mini-logo" />
          <span>OriginTrace</span>
        </span>
        <span className="text-sm text-slate-text-secondary">
          Admin: {user?.full_name || '[Jorge]'}
          <button onClick={logout} className="ml-2 text-secondary font-bold">Sign out</button>
        </span>
      </div>

      <div className="max-w-3xl mx-auto p-6">
        <h2 className="text-xl font-bold mb-1">Admin panel</h2>
        <p className="text-sm text-slate-text-muted mb-6">Create subjects, assign instructors, and enroll students.</p>

        {error && (
          <div className="bg-risk-high/10 text-risk-high text-sm font-semibold px-4 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-risk-low/10 text-risk-low text-sm font-semibold px-4 py-2 rounded-lg mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleCreateSubject} className="bg-white border border-border-standard rounded-xl p-5 mb-6 shadow-sm space-y-3">
          <h3 className="font-bold text-sm">Create subject</h3>
          <input
            type="text"
            placeholder="Subject code (e.g. CS101)"
            value={subjectCode}
            onChange={(e) => setSubjectCode(e.target.value)}
            required
            disabled={submitting || loading}
            className="w-full border border-border-standard rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Subject title"
            value={subjectTitle}
            onChange={(e) => setSubjectTitle(e.target.value)}
            required
            disabled={submitting || loading}
            className="w-full border border-border-standard rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={selectedInstructor}
            onChange={(e) => setSelectedInstructor(e.target.value)}
            required
            disabled={submitting || loading}
            className="w-full border border-border-standard rounded-lg px-3 py-2 text-sm"
          >
            <option value="">-- Assign instructor --</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.full_name} ({instructor.email})
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full bg-secondary text-white py-2.5 rounded-lg text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create subject'}
          </button>
        </form>

        <form onSubmit={handleEnroll} className="bg-white border border-border-standard rounded-xl p-5 mb-6 shadow-sm space-y-3">
          <h3 className="font-bold text-sm">Enroll student</h3>
          <div>
            <label htmlFor="subject-select" className="text-xs font-semibold text-slate-text-secondary block mb-1">
              Select subject
            </label>
            <select
              id="subject-select"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              required
              disabled={submitting || loading}
              className="w-full border border-border-standard rounded-lg px-3 py-2 text-sm"
            >
              <option value="">-- Choose subject --</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.subject_code} - {sub.subject_title}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="student-select" className="text-xs font-semibold text-slate-text-secondary block mb-1">
              Select student
            </label>
            <select
              id="student-select"
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              required
              disabled={submitting || loading}
              className="w-full border border-border-standard rounded-lg px-3 py-2 text-sm"
            >
              <option value="">-- Choose student --</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>{student.full_name} ({student.email})</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full bg-secondary text-white py-2.5 rounded-lg text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            {submitting ? 'Enrolling…' : 'Enroll student'}
          </button>
        </form>

        <h3 className="font-bold text-sm mb-3">Current enrollments</h3>
        {loading ? (
          <p className="text-sm text-slate-text-muted">Loading enrollments…</p>
        ) : enrollments.length === 0 ? (
          <div className="border border-dashed border-border-standard rounded-xl p-8 text-center text-sm text-slate-text-muted">
            No enrollments yet.
          </div>
        ) : (
          <div className="bg-white border border-border-standard rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container-low border-b border-border-standard">
                  <th className="text-left px-4 py-2 font-semibold text-slate-text-muted">Student name</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-text-muted">Email</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-text-muted">Subject</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-standard">
                {enrollments.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2">{item.student_name || item.student_id}</td>
                    <td className="px-4 py-2">{item.student_email || 'N/A'}</td>
                    <td className="px-4 py-2">{item.subject_code ? `${item.subject_code} - ${item.subject_title}` : item.subject_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
