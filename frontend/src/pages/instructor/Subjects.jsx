import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSubjects();
  }, []);

  async function fetchSubjects() {
    try {
      setLoading(true);
      const res = await api.get('/subjects');
      setSubjects(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load subjects.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!code || !title) return;

    setSubmitting(true);
    try {
      const res = await api.post('/subjects', { code, title });
      setSubjects((prev) => [...prev, res.data]);
      setCode('');
      setTitle('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create subject.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(subjectId, field, currentValue) {
    try {
      const res = await api.patch(`/subjects/${subjectId}`, {
        [field]: !currentValue,
      });

      setSubjects((prev) =>
        prev.map((item) => (item.id === subjectId ? res.data : item))
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update toggle state.');
    }
  }

  return (
    <div className="subjects-page">
      <h2>Instructor Subjects</h2>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleCreate} className="new-subject-form">
        <h3>Create New Subject</h3>
        <div className="form-row">
          <input
            type="text"
            placeholder="Subject Code (e.g. CS101)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            disabled={submitting}
          />
          <input
            type="text"
            placeholder="Subject Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={submitting}
          />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Add Subject'}
          </button>
        </div>
      </form>

      {loading ? (
        <p>Loading subjects...</p>
      ) : subjects.length === 0 ? (
        <div className="empty-state">
          <p>No subjects found. Create your first subject above to get started.</p>
        </div>
      ) : (
        <div className="subjects-list">
          {subjects.map((sub) => (
            <div key={sub.id} className="subject-row">
              <div className="subject-info">
                <span className="subject-code">{sub.code}</span>
                <span className="subject-title">{sub.title}</span>
              </div>

              <div className="subject-badges-and-toggles">
                <div className="toggle-group">
                  <span className={`badge ${sub.isPublished ? 'published' : 'draft'}`}>
                    {sub.isPublished ? 'Published' : 'Draft'}
                  </span>
                  <button
                    className="toggle-button"
                    onClick={() => handleToggle(sub.id, 'isPublished', sub.isPublished)}
                  >
                    Toggle Status
                  </button>
                </div>

                <div className="toggle-group">
                  <span className={`badge ${sub.isOpen ? 'open' : 'closed'}`}>
                    {sub.isOpen ? 'Open' : 'Closed'}
                  </span>
                  <button
                    className="toggle-button"
                    onClick={() => handleToggle(sub.id, 'isOpen', sub.isOpen)}
                  >
                    Toggle Enrollment
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