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
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await requirePool().query(
      'SELECT id, email, password_hash, role, full_name FROM users WHERE email = $1',
      [email.toLowerCase().trim()],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { password_hash: _passwordHash, ...publicUser } = user;
    return res.json({ token: signUserToken(user), user: publicUser });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/me', requireAuth, async (req, res, next) => {
  try {
    const result = await requirePool().query(
      'SELECT id, email, role, full_name FROM users WHERE id = $1',
      [req.user.sub],
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/instructor/submissions', requireAuth, allowRoles('instructor'), async (_req, res, next) => {
  try {
    const result = await requirePool().query(`
      SELECT s.id, u.full_name AS student, s.language, s.status, s.submitted_at,
             r.risk_band
      FROM submissions s
      JOIN users u ON u.id = s.student_id
      LEFT JOIN risk_scores r ON r.submission_id = s.id
      ORDER BY s.submitted_at DESC
    `);
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
    const usedRow = await pool.query(
      `SELECT count(*)::int AS used FROM submissions
       WHERE student_id = $1 AND is_self_check = true
         AND submitted_at >= current_date`,
      [req.user.sub],
    );
    const limit = Number(limitRow.rows[0]?.limit ?? 3);
    const used = usedRow.rows[0].used;
    return res.json({ limit, used, remaining: Math.max(0, limit - used), window: 'daily' });
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
  const status = error.status || 500;
  if (status === 500) console.error(error);
  res.status(status).json({ error: status === 500 ? 'Internal server error' : error.message });
});