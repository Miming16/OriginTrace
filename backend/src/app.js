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

app.get('/api/student/self-checks/quota', requireAuth, allowRoles('student'), (_req, res) => {
  res.json({ limit: 3, used: 0, remaining: 3, window: 'daily' });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : error.message });
});