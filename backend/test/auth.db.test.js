// WBS 1.4 / 1.4.1.2 / 1.2.1 -- authentication against a real database.
//
// Requires db/migrations/001_initial_schema.sql applied and
// db/seeds/001_dev_users.sql loaded. Skipped automatically when DATABASE_URL is
// unset, so `npm test` stays green without a database.
//
// Response shapes are checked against docs/0.5_api_contract.yaml; where the
// implementation and the contract disagree the test records the disagreement as
// a defect rather than asserting the contract's version.

import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db.js';

const skip = process.env.DATABASE_URL ? false : 'DATABASE_URL is not set';

const SEED = {
  student: { id_number: '2023018093', id: '11111111-1111-4111-8111-111111111111' },
  instructor: { id_number: '2023018092', id: '22222222-2222-4222-8222-222222222222' },
  admin: { id_number: '2023018091', id: '33333333-3333-4333-8333-333333333333' },
};
const PASSWORD = 'Passw0rd!';

after(async () => {
  if (pool) await pool.end();
});

const login = (id_number, password) =>
  request(app).post('/api/auth/login').send({ id_number, password });

async function tokenFor(role) {
  const response = await login(SEED[role].email, PASSWORD);
  assert.equal(response.status, 200, `could not log in as ${role}: are the seeds loaded?`);
  return response.body.token;
}

test('login with correct credentials returns a token and the public user', { skip }, async () => {
  const response = await login(SEED.instructor.email, PASSWORD);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body).sort(), ['token', 'user']);
  assert.equal(typeof response.body.token, 'string');
  assert.equal(response.body.token.split('.').length, 3, 'token is not a JWT');
  assert.deepEqual(response.body.user, {
    id: SEED.instructor.id,
    email: SEED.instructor.email,
    role: 'instructor',
    full_name: 'Ingrid Instructor',
  });
});

test('login never leaks password_hash, in any casing', { skip }, async () => {
  const response = await login(SEED.student.email, PASSWORD);
  assert.equal(response.status, 200);
  const serialised = JSON.stringify(response.body);
  assert.ok(!('password_hash' in response.body.user), 'password_hash present on user');
  assert.ok(!/\$2[aby]\$/.test(serialised), 'a bcrypt hash appears in the login response');
  assert.ok(!/password/i.test(Object.keys(response.body.user).join(' ')));
});

test('login normalises the submitted email (lowercased and trimmed)', { skip }, async () => {
  const response = await login(`  ${SEED.admin.email.toUpperCase()}  `, PASSWORD);
  assert.equal(response.status, 200);
  assert.equal(response.body.user.id, SEED.admin.id);
});

test('login with the wrong password is 401 and reveals nothing', { skip }, async () => {
  const response = await login(SEED.student.email, 'not-the-password');
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: 'Invalid credentials' });
});

test('login with an unknown email is 401, identical to a wrong password', { skip }, async () => {
  const response = await login('nobody@origintrace.test', PASSWORD);
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: 'Invalid credentials' });
});

test('login with missing fields is 400', { skip }, async () => {
  for (const body of [{}, { email: SEED.student.email }, { password: PASSWORD }, { email: '', password: '' }]) {
    const response = await request(app).post('/api/auth/login').send(body);
    assert.equal(response.status, 400, `body ${JSON.stringify(body)} was not a 400`);
    assert.deepEqual(response.body, { error: 'Email and password are required' });
  }
});

test('GET /api/me returns the same user the token was issued for', { skip }, async () => {
  const response = await login(SEED.student.email, PASSWORD);
  const me = await request(app).get('/api/me').set('Authorization', `Bearer ${response.body.token}`);
  assert.equal(me.status, 200);
  assert.deepEqual(me.body, { user: response.body.user });
});

test('GET /api/me with a token for a deleted user is 404', { skip }, async () => {
  const { signUserToken } = await import('../src/auth.js');
  const orphan = signUserToken({
    id: '00000000-0000-4000-8000-000000000000',
    role: 'student',
    email: 'ghost@origintrace.test',
  });
  const response = await request(app).get('/api/me').set('Authorization', `Bearer ${orphan}`);
  assert.equal(response.status, 404);
});

test('GET /api/instructor/submissions is 200 with an empty list on a fresh database', { skip }, async () => {
  const token = await tokenFor('instructor');
  const response = await request(app)
    .get('/api/instructor/submissions')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body), ['submissions']);
  assert.ok(Array.isArray(response.body.submissions));
  assert.deepEqual(response.body.submissions, []);
});

test('WBS 1.2.1: twenty concurrent /api/me requests all succeed on the pool', { skip }, async () => {
  const token = await tokenFor('student');
  const responses = await Promise.all(
    Array.from({ length: 20 }, () =>
      request(app).get('/api/me').set('Authorization', `Bearer ${token}`),
    ),
  );
  assert.equal(responses.length, 20);
  for (const response of responses) {
    assert.equal(response.status, 200, `pool returned ${response.status}: ${JSON.stringify(response.body)}`);
    assert.equal(response.body.user.id, SEED.student.id);
  }
  assert.ok(pool.totalCount <= pool.options.max, 'pool grew beyond its configured maximum');
});

test('every status code documented in 0.5_api_contract.yaml is reachable', { skip }, async () => {
  const instructor = await tokenFor('instructor');
  const student = await tokenFor('student');
  const cases = [
    ['GET  /health 200', () => request(app).get('/api/health'), 200],
    ['POST /auth/login 200', () => login(SEED.student.email, PASSWORD), 200],
    ['POST /auth/login 400', () => request(app).post('/api/auth/login').send({}), 400],
    ['POST /auth/login 401', () => login(SEED.student.email, 'wrong'), 401],
    ['GET  /me 200', () => request(app).get('/api/me').set('Authorization', `Bearer ${student}`), 200],
    ['GET  /me 401', () => request(app).get('/api/me'), 401],
    ['GET  /instructor/submissions 200', () => request(app).get('/api/instructor/submissions').set('Authorization', `Bearer ${instructor}`), 200],
    ['GET  /instructor/submissions 401', () => request(app).get('/api/instructor/submissions'), 401],
    ['GET  /instructor/submissions 403', () => request(app).get('/api/instructor/submissions').set('Authorization', `Bearer ${student}`), 403],
    ['GET  /student/self-checks/quota 200', () => request(app).get('/api/student/self-checks/quota').set('Authorization', `Bearer ${student}`), 200],
    ['GET  /student/self-checks/quota 401', () => request(app).get('/api/student/self-checks/quota'), 401],
    ['GET  /student/self-checks/quota 403', () => request(app).get('/api/student/self-checks/quota').set('Authorization', `Bearer ${instructor}`), 403],
  ];
  for (const [label, run, expected] of cases) {
    const response = await run();
    assert.equal(response.status, expected, `${label} returned ${response.status}`);
  }
});

// --- Evidence for defects, not aspirations. -----------------------------------

test('quota counts today\'s self-checks and reaches zero at the limit', { skip }, async () => {
  const token = await tokenFor('student');
  const before = await request(app)
    .get('/api/student/self-checks/quota')
    .set('Authorization', `Bearer ${token}`);
  assert.deepEqual(before.body, { limit: 3, used: 0, remaining: 3, window: 'daily' });

  // Commit three self-checks for this student today, so a real implementation
  // would have to report used: 3, remaining: 0.
  await pool.query(
    `INSERT INTO submissions (student_id, source_type, source_url, language, is_self_check, status)
     SELECT $1, 'git', 'https://example.test/quota-probe.git', 'python', true, 'complete'
     FROM generate_series(1, 3)`,
    [SEED.student.id],
  );
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM submissions
       WHERE student_id = $1 AND is_self_check = true AND submitted_at >= current_date`,
      [SEED.student.id],
    );
    assert.equal(rows[0].n, 3, 'probe rows were not committed');

    const after = await request(app)
      .get('/api/student/self-checks/quota')
      .set('Authorization', `Bearer ${token}`);
    assert.deepEqual(
      after.body,
      { limit: 3, used: 3, remaining: 0, window: 'daily' },
      'quota must count real self-checks, not return a constant',
    );
  } finally {
    await pool.query(
      "DELETE FROM submissions WHERE source_url = 'https://example.test/quota-probe.git'",
    );
  }
});

test('DEFECT D-04: POST /api/auth/register does not exist (WBS 1.4 requires it)', { skip }, async () => {
  const response = await request(app).post('/api/auth/register').send({
    email: 'new@origintrace.test',
    password: PASSWORD,
    role: 'student',
    full_name: 'New User',
  });
  assert.equal(response.status, 404, 'register appears to exist now -- D-04 can be closed');
});
