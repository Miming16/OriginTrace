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
  const [activeTab, setActiveTab] = useState('enrollments');

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

  async function handleCSVUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      const studentsToImport = lines.slice(1).map((line) => {
        const [id_number, full_name, email] = line.split(',').map((value) => value.trim());
        return { id_number, full_name, email };
      });
      const response = await api.post('/admin/students/csv', { students: studentsToImport });
      await fetchInitialData();
      setSuccess(`${response.data.count} student${response.data.count === 1 ? '' : 's'} imported successfully.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to import students.');
    } finally {
      setSubmitting(false);
      e.target.value = '';
    }
  }

  return (
    <div className="flex min-h-screen bg-background text-primary">
      <aside className="w-52 shrink-0 bg-white border-r border-border-standard p-4 flex flex-col">
        <div className="flex items-center gap-2 font-bold text-lg mb-8">
          <img src="/origintrace-logo-home.png" alt="OriginTrace logo" className="brand-logo mini-logo" />
          <span>OriginTrace</span>
        </div>
        <nav className="space-y-1" aria-label="Admin sections">
          {[
            ['students', 'Students'],
            ['subjects', 'Subjects'],
            ['enrollments', 'Enrollments'],
          ].map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold ${activeTab === tab ? 'bg-secondary text-white' : 'text-slate-text-secondary hover:bg-surface-container-low'}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-8">
          <p className="text-xs text-slate-text-muted mb-2">Admin: {user?.full_name || 'Admin'}</p>
          <button type="button" onClick={logout} className="w-full text-left px-3 py-2 text-sm font-bold text-secondary hover:bg-surface-container-low rounded-lg">
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
        <h2 className="text-xl font-bold mb-1">Admin panel</h2>
        <p className="text-sm text-slate-text-muted mb-6">Manage students, subjects, and enrollments.</p>

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

        {activeTab === 'students' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm">Students</h3>
              <label className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:opacity-90">
                Import CSV
                <input type="file" accept=".csv" onChange={handleCSVUpload} disabled={submitting || loading} className="hidden" />
              </label>
            </div>
            {loading ? (
              <p className="text-sm text-slate-text-muted">Loading students…</p>
            ) : (
              <div className="bg-white border border-border-standard rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-border-standard">
                      <th className="text-left px-4 py-2 font-semibold text-slate-text-muted">ID number</th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-text-muted">Full name</th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-text-muted">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-standard">
                    {students.map((student) => (
                      <tr key={student.id}>
                        <td className="px-4 py-2">{student.id_number}</td>
                        <td className="px-4 py-2">{student.full_name}</td>
                        <td className="px-4 py-2">{student.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!students.length && <p className="p-6 text-sm text-slate-text-muted">No students found.</p>}
              </div>
            )}
          </section>
        )}

        {activeTab === 'subjects' && (
          <section>
            <h3 className="font-bold text-sm mb-4">Subjects</h3>
            <div className="bg-white border border-border-standard rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-low border-b border-border-standard">
                    <th className="text-left px-4 py-2 font-semibold text-slate-text-muted">Subject code</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-text-muted">Title</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-text-muted">Instructor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-standard">
                  {subjects.map((subject) => (
                    <tr key={subject.id}>
                      <td className="px-4 py-2">{subject.subject_code}</td>
                      <td className="px-4 py-2">{subject.subject_title}</td>
                      <td className="px-4 py-2">{subject.instructor || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!subjects.length && <p className="p-6 text-sm text-slate-text-muted">No subjects found.</p>}
            </div>
          </section>
        )}

        {activeTab === 'enrollments' && (
          <section>

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
          </section>
        )}
        </div>
      </main>
    </div>
  );
}
