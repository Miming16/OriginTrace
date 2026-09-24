import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { allowRoles, requireAuth, signUserToken } from './auth.js';
import { requirePool } from './db.js';

export const app = express();

app.use(cors({ origin: config.frontendOrigin }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'origintrace-api' });
});

app.post('/api/auth/login', async (req, res, next) => {
  const { idNumber, password } = req.body || {};
  if (!idNumber || !password) {
    return res.status(400).json({ error: 'ID number and password are required' });
  }

  try {
    const result = await requirePool().query(
      'SELECT id, id_number, email, password_hash, role, full_name FROM users WHERE id_number = $1',
      [String(idNumber).trim()],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { password_hash: _hash, ...publicUser } = user;
    return res.json({ token: signUserToken(user), user: publicUser });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/me', requireAuth, async (req, res, next) => {
  try {
    const result = await requirePool().query(
      'SELECT id, id_number, email, role, full_name FROM users WHERE id = $1',
      [req.user.sub],
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/instructor/submissions', requireAuth, allowRoles('instructor'), async (req, res, next) => {
  try {
    const result = await requirePool().query(
      `SELECT sub.id, u.full_name AS student, subj.subject_code,
              sub.language, sub.status, sub.submitted_at,
              UPPER(r.risk_band) AS risk_band, r.similarity_score,
              d.decision, a.title AS assignment
       FROM submissions sub
       JOIN users u    ON u.id = sub.student_id
       JOIN subjects subj ON subj.id = sub.subject_id
       LEFT JOIN risk_scores r ON r.submission_id = sub.id
       LEFT JOIN originality_decisions d ON d.submission_id = sub.id
       LEFT JOIN assignments a ON a.id = sub.assignment_id
       WHERE subj.instructor_id = $1 AND sub.is_self_check = false
        AND ($2::uuid IS NULL OR subj.id = $2::uuid)
        AND ($3::uuid IS NULL OR sub.assignment_id = $3::uuid)
       ORDER BY sub.submitted_at DESC`,
      [req.user.sub, req.query.subject_id || null, req.query.assignment_id || null],
    );
    return res.json({ submissions: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/student/self-checks/quota', requireAuth, allowRoles('student'), async (req, res, next) => {
  const subjectId = req.query.subject_id || null;
  try {
    const pool = requirePool();
    const limitRow = await pool.query(
      'SELECT COALESCE(MIN(self_check_limit), 3) AS limit FROM subjects WHERE id = $1',
      [subjectId],
    );
    const usedQuery = subjectId
      ? `SELECT count(*)::int AS used FROM submissions
         WHERE student_id = $1 AND subject_id = $2 AND is_self_check = true
           AND submitted_at >= current_date`
      : `SELECT count(*)::int AS used FROM submissions
         WHERE student_id = $1 AND is_self_check = true
           AND submitted_at >= current_date`;
    const usedRow = await pool.query(usedQuery, subjectId ? [req.user.sub, subjectId] : [req.user.sub]);
    const limit = Number(limitRow.rows[0]?.limit ?? 3);
    const used = usedRow.rows[0].used;
    return res.json({ limit, used, remaining: Math.max(0, limit - used), window: 'daily' });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/student/self-checks', requireAuth, allowRoles('student'), async (req, res, next) => {
  try {
    const result = await requirePool().query(
      `SELECT sub.id, subj.subject_code, subj.subject_title,
              sub.language, sub.status, sub.submitted_at,
              UPPER(r.risk_band) AS risk_band
       FROM submissions sub
       LEFT JOIN subjects subj ON subj.id = sub.subject_id
       LEFT JOIN risk_scores r ON r.submission_id = sub.id
       WHERE sub.student_id = $1 AND sub.is_self_check = true
         AND ($2::uuid IS NULL OR sub.subject_id = $2::uuid)
       ORDER BY sub.submitted_at DESC
       LIMIT 50`,
      [req.user.sub, req.query.subject_id || null],
    );
    return res.json({ self_checks: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/instructor/submissions/:id', requireAuth, allowRoles('instructor'), async (req, res, next) => {
  const pool = requirePool();
  try {
    const owned = await pool.query(
      `SELECT sub.id FROM submissions sub
       JOIN subjects s ON s.id = sub.subject_id
       WHERE sub.id = $1 AND s.instructor_id = $2`,
      [req.params.id, req.user.sub],
    );
    if (!owned.rows[0]) return res.status(404).json({ error: 'Submission not found' });

    const [risk, peers, commits, flags, decision] = await Promise.all([
      pool.query('SELECT risk_band, similarity_score FROM risk_scores WHERE submission_id = $1', [req.params.id]),
      pool.query(
        `SELECT u.full_name AS peer_student, m.submission_id AS peer_submission_id
         FROM similarity_cluster_members me
         JOIN similarity_cluster_members m ON m.cluster_id = me.cluster_id
                                          AND m.submission_id <> me.submission_id
         JOIN submissions p ON p.id = m.submission_id
         JOIN users u       ON u.id = p.student_id
         WHERE me.submission_id = $1`,
        [req.params.id],
      ),
      pool.query(`SELECT signal_type, severity, description, commit_count, timespan_days,
             has_big_bang, low_entropy_count, author_committer_match_pct
          FROM commit_signals WHERE submission_id = $1`, [req.params.id]),
      pool.query(`SELECT flag_type, severity, flag_level, description
          FROM provenance_flags WHERE submission_id = $1`, [req.params.id]),
      pool.query('SELECT decision, note, decided_at FROM originality_decisions WHERE submission_id = $1', [req.params.id]),
    ]);

    return res.json({
      risk: risk.rows[0] || null,
      peers: peers.rows,
      commit_signals: commits.rows,
      provenance_flags: flags.rows,
      decision: decision.rows[0] || null,
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/instructor/submissions/:id/decision', requireAuth, allowRoles('instructor'), async (req, res, next) => {
  const { decision, note } = req.body || {};
  const allowed = ['cleared', 'under_review', 'flagged'];
  if (!allowed.includes(decision)) {
    return res.status(400).json({ error: `decision must be one of ${allowed.join(', ')}` });
  }

  try {
    const pool = requirePool();
    const owned = await pool.query(
      `SELECT 1 FROM submissions sub
       JOIN subjects s ON s.id = sub.subject_id
       WHERE sub.id = $1 AND s.instructor_id = $2`,
      [req.params.id, req.user.sub],
    );
    if (!owned.rows[0]) return res.status(404).json({ error: 'Submission not found' });

    const result = await pool.query(
      `INSERT INTO originality_decisions (submission_id, instructor_id, decision, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (submission_id)
       DO UPDATE SET decision = EXCLUDED.decision, note = EXCLUDED.note,
                     instructor_id = EXCLUDED.instructor_id, decided_at = now()
       RETURNING decision, note, decided_at`,
      [req.params.id, req.user.sub, decision, note || null],
    );
    return res.json({ decision: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/instructor/subjects', requireAuth, allowRoles('instructor'), async (req, res, next) => {
  const { subject_code: code, subject_title: title, self_check_limit: limit } = req.body || {};
  if (!code || !title) {
    return res.status(400).json({ error: 'subject_code and subject_title are required' });
  }

  try {
    const result = await requirePool().query(
      `INSERT INTO subjects (instructor_id, subject_code, subject_title, self_check_limit)
       VALUES ($1, $2, $3, COALESCE($4, 3))
       RETURNING id, subject_code, subject_title, is_published, is_open, self_check_limit`,
      [req.user.sub, code, title, limit ?? null],
    );
    return res.status(201).json({ subject: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/instructor/subjects', requireAuth, allowRoles('instructor'), async (req, res, next) => {
  try {
    const result = await requirePool().query(
      `SELECT s.id, s.subject_code, s.subject_title, s.is_published, s.is_open,
              s.self_check_limit,
              count(e.id)::int AS enrolled_count
       FROM subjects s
       LEFT JOIN enrollments e ON e.subject_id = s.id
       WHERE s.instructor_id = $1
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      [req.user.sub],
    );
    return res.json({ subjects: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/instructor/subjects/:id', requireAuth, allowRoles('instructor'), async (req, res, next) => {
  const { is_published: published, is_open: open } = req.body || {};
  if (published === undefined && open === undefined) {
    return res.status(400).json({ error: 'Provide is_published or is_open' });
  }

  try {
    const result = await requirePool().query(
      `UPDATE subjects
          SET is_published = COALESCE($1, is_published),
              is_open      = COALESCE($2, is_open)
        WHERE id = $3 AND instructor_id = $4
        RETURNING id, subject_code, subject_title, is_published, is_open`,
      [published ?? null, open ?? null, req.params.id, req.user.sub],
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Subject not found' });
    return res.json({ subject: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/instructor/subjects/:id/assignments', requireAuth, allowRoles('instructor'), async (req, res, next) => {
  const { title, instructions, due_at: dueAt } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const result = await requirePool().query(
      `INSERT INTO assignments (subject_id, title, instructions, due_at)
       SELECT s.id, $3::text, $4::text, $5::timestamptz
       FROM subjects s
       WHERE s.id = $1 AND s.instructor_id = $2
       RETURNING id, subject_id, title, instructions, due_at, created_at`,
      [req.params.id, req.user.sub, String(title).trim(), instructions || null, dueAt || null],
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Subject not found' });
    return res.status(201).json({ assignment: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/instructor/subjects/:id/assignments', requireAuth, allowRoles('instructor'), async (req, res, next) => {
  try {
    const result = await requirePool().query(
      `SELECT a.id, a.title, a.instructions, a.due_at, a.created_at,
              count(sub.id) FILTER (WHERE sub.is_self_check = false)::int AS submission_count
       FROM assignments a
       JOIN subjects s ON s.id = a.subject_id
       LEFT JOIN submissions sub ON sub.assignment_id = a.id
       WHERE a.subject_id = $1 AND s.instructor_id = $2
       GROUP BY a.id
       ORDER BY a.due_at NULLS LAST, a.created_at`,
      [req.params.id, req.user.sub],
    );
    return res.json({ assignments: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/student/subjects', requireAuth, allowRoles('student'), async (req, res, next) => {
  try {
    const result = await requirePool().query(
      `SELECT s.id, s.subject_code, s.subject_title, s.is_open, s.self_check_limit
       FROM subjects s
       JOIN enrollments e ON e.subject_id = s.id
       WHERE e.student_id = $1 AND s.is_published = true
       ORDER BY s.subject_code`,
      [req.user.sub],
    );
    return res.json({ subjects: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/student/subjects/:id/assignments', requireAuth, allowRoles('student'), async (req, res, next) => {
  try {
    const result = await requirePool().query(
      `SELECT a.id, a.title, a.instructions, a.due_at,
              count(sub.id) FILTER (WHERE sub.is_self_check)::int AS self_checks,
              count(sub.id) FILTER (WHERE NOT sub.is_self_check)::int AS attempts,
              UPPER((array_agg(r.risk_band ORDER BY sub.submitted_at DESC)
                     FILTER (WHERE sub.is_self_check))[1]) AS last_self_check_band
       FROM assignments a
       JOIN subjects s    ON s.id = a.subject_id AND s.is_published = true
       JOIN enrollments e ON e.subject_id = s.id AND e.student_id = $2
       LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = $2
       LEFT JOIN risk_scores r   ON r.submission_id = sub.id
       WHERE a.subject_id = $1
       GROUP BY a.id
       ORDER BY a.due_at NULLS LAST, a.created_at`,
      [req.params.id, req.user.sub],
    );
    return res.json({ assignments: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/admin/students', requireAuth, allowRoles('admin'), async (_req, res, next) => {
  try {
    const result = await requirePool().query(
      "SELECT id, full_name, email FROM users WHERE role = 'student' ORDER BY full_name",
    );
    return res.json({ students: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/admin/instructors', requireAuth, allowRoles('admin'), async (_req, res, next) => {
  try {
    const result = await requirePool().query(
      "SELECT id, full_name, email FROM users WHERE role = 'instructor' ORDER BY full_name",
    );
    return res.json({ instructors: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/admin/subjects', requireAuth, allowRoles('admin'), async (_req, res, next) => {
  try {
    const result = await requirePool().query(
      `SELECT s.id, s.subject_code, s.subject_title, u.full_name AS instructor
       FROM subjects s
       JOIN users u ON u.id = s.instructor_id
       ORDER BY s.subject_code`,
    );
    return res.json({ subjects: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/admin/subjects', requireAuth, allowRoles('admin'), async (req, res, next) => {
  const { subject_code: code, subject_title: title, instructor_id: instructorId } = req.body || {};
  if (!code || !title || !instructorId) {
    return res.status(400).json({ error: 'subject_code, subject_title, and instructor_id are required' });
  }

  try {
    const result = await requirePool().query(
      `INSERT INTO subjects (instructor_id, subject_code, subject_title)
       SELECT id, $2, $3
       FROM users
       WHERE id = $1 AND role = 'instructor'
       RETURNING id, subject_code, subject_title, instructor_id, is_published, is_open, self_check_limit`,
      [instructorId, code, title],
    );
    if (!result.rows[0]) return res.status(400).json({ error: 'Instructor not found' });
    return res.status(201).json({ subject: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/admin/subjects/:id/enrollments', requireAuth, allowRoles('admin'), async (req, res, next) => {
  const { student_id: studentId } = req.body || {};
  if (!studentId) return res.status(400).json({ error: 'student_id is required' });

  try {
    const result = await requirePool().query(
      `INSERT INTO enrollments (student_id, subject_id)
       VALUES ($1, $2)
       ON CONFLICT (student_id, subject_id) DO NOTHING
       RETURNING id, enrolled_at`,
      [studentId, req.params.id],
    );
    if (!result.rows[0]) {
      return res.status(409).json({ error: 'Student is already enrolled in this subject' });
    }
    return res.status(201).json({ enrollment: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/admin/enrollments', requireAuth, allowRoles('admin'), async (_req, res, next) => {
  try {
    const result = await requirePool().query(
      `SELECT e.id, e.enrolled_at,
              u.id AS student_id, u.full_name AS student_name, u.email AS student_email,
              s.id AS subject_id, s.subject_code, s.subject_title
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       JOIN subjects s ON s.id = e.subject_id
       ORDER BY e.enrolled_at DESC`,
    );
    return res.json({ enrollments: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/admin/subjects/:id/enrollments', requireAuth, allowRoles('admin'), async (req, res, next) => {
  try {
    const result = await requirePool().query(
      `SELECT e.id, u.full_name, u.email, e.enrolled_at
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       WHERE e.subject_id = $1
       ORDER BY u.full_name`,
      [req.params.id],
    );
    return res.json({ enrollments: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/admin/enrollments/:id', requireAuth, allowRoles('admin'), async (req, res, next) => {
  try {
    const result = await requirePool().query(
      'DELETE FROM enrollments WHERE id = $1 RETURNING id',
      [req.params.id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Enrollment not found' });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.status || (error.code === '22P02' ? 400 : 500);
  if (status === 500) console.error(error);
  res.status(status).json({ error: status === 500 ? 'Internal server error' : error.message });
});