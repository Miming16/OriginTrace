import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSubjects();
  }, []);

  async function fetchSubjects() {
    try {
      setLoading(true);
      const res = await api.get('/instructor/subjects');
      setSubjects(
        res.data.subjects.map((subject) => ({
          ...subject,
          code: subject.subject_code,
          title: subject.subject_title,
          isPublished: subject.is_published,
          isOpen: subject.is_open,
        }))
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load subjects.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(subjectId, field, currentValue) {
    try {
      const backendField =
        field === 'isPublished' ? 'is_published' : 'is_open';

    const res = await api.patch(`/instructor/subjects/${subjectId}`, {
      [backendField]: !currentValue,
    });

    const subject = res.data.subject;

    setSubjects((prev) =>
      prev.map((item) =>
        item.id === subjectId
          ? {
              ...subject,
              code: subject.subject_code,
              title: subject.subject_title,
              isPublished: subject.is_published,
              isOpen: subject.is_open,
            }
          : item
      )
    );
  } catch (err) {
    setError(
      err.response?.data?.error || 'Failed to update toggle state.'
    );
    }
}

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Instructor subjects</h2>
      <p className="text-sm text-slate-text-muted mb-6">
        Manage subject publish/draft state and enrollment open/closed status.
      </p>

      {error && (
        <div className="bg-risk-high/10 text-risk-high text-sm font-semibold px-4 py-2 rounded-lg mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-text-muted">Loading subjects…</p>
      ) : subjects.length === 0 ? (
        <div className="border border-dashed border-border-standard rounded-xl p-8 text-center text-sm text-slate-text-muted">
          No subjects found. Create your first subject above to get started.
        </div>
      ) : (
        <div className="bg-white border border-border-standard rounded-xl overflow-hidden shadow-sm divide-y divide-border-standard">
          {subjects.map((sub) => (
            <div key={sub.id} className="flex items-center justify-between px-5 py-4 flex-wrap gap-3">
              <div>
                <span className="font-bold text-primary">{sub.code}</span>
                <span className="text-slate-text-secondary ml-2">{sub.title}</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    sub.isPublished ? 'bg-risk-low/10 text-risk-low' : 'bg-surface-container-high text-slate-text-muted'
                  }`}>
                    {sub.isPublished ? 'Published' : 'Draft'}
                  </span>
                  <button
                    onClick={() => handleToggle(sub.id, 'isPublished', sub.isPublished)}
                    className="text-xs font-semibold text-secondary border border-border-standard rounded-md px-2 py-1 hover:bg-surface-container-low transition"
                  >
                    Toggle status
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    sub.isOpen ? 'bg-risk-low/10 text-risk-low' : 'bg-risk-high/10 text-risk-high'
                  }`}>
                    {sub.isOpen ? 'Open' : 'Closed'}
                  </span>
                  <button
                    onClick={() => handleToggle(sub.id, 'isOpen', sub.isOpen)}
                    className="text-xs font-semibold text-secondary border border-border-standard rounded-md px-2 py-1 hover:bg-surface-container-low transition"
                  >
                    Toggle enrollment
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
