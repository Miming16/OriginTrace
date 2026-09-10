// WBS 1.4 / 1.4.1.1 -- JWT verification and role middleware, without a database.
//
// Complements the five pre-existing tests in routes.test.js by covering the
// rejection paths: tokens the service must refuse, header shapes it must refuse,
// and the role matrix. Nothing here touches PostgreSQL, so it runs in plain
// `npm test`.

import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { signUserToken } from '../src/auth.js';

const tokenFor = (role) =>
  signUserToken({ id: `${role}-test`, role, email: `${role}@test.local` });

const PROTECTED_ROUTES = ['/api/instructor/submissions', '/api/student/self-checks/quota'];

test('/api/health returns exactly the two documented fields', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok', service: 'origintrace-api' });
  assert.deepEqual(Object.keys(response.body).sort(), ['service', 'status']);
});

test('a token signed with the wrong secret is rejected', async () => {
  const forged = jwt.sign(
    { sub: 'instructor-test', role: 'instructor', email: 'instructor@test.local' },
    `${config.jwtSecret}-not-the-real-secret`,
    { expiresIn: '8h' },
  );
  for (const route of PROTECTED_ROUTES) {
    const response = await request(app).get(route).set('Authorization', `Bearer ${forged}`);
    assert.equal(response.status, 401, `${route} accepted a forged token`);
    assert.equal(response.body.error, 'Invalid or expired token');
  }
});

test('an expired token is rejected even though it is correctly signed', async () => {
  const expired = jwt.sign(
    { sub: 'instructor-test', role: 'instructor', email: 'instructor@test.local' },
    config.jwtSecret,
    { expiresIn: '-1s' },
  );
  const response = await request(app)
    .get('/api/instructor/submissions')
    .set('Authorization', `Bearer ${expired}`);
  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'Invalid or expired token');
});

test('a token with no expiry claim is still accepted (records current behaviour)', async () => {
  const everlasting = jwt.sign({ sub: 'student-test', role: 'student' }, config.jwtSecret);
  const response = await request(app)
    .get('/api/student/self-checks/quota')
    .set('Authorization', `Bearer ${everlasting}`);
  assert.equal(response.status, 200);
});

test('malformed Authorization headers are rejected with 401', async () => {
  const valid = tokenFor('instructor');
  const malformed = [
    ['empty header', ''],
    ['scheme only', 'Bearer'],
    ['scheme with no token', 'Bearer '],
    ['wrong scheme', `Basic ${valid}`],
    ['lowercase scheme', `bearer ${valid}`],
    ['token without scheme', valid],
    ['double scheme', `Bearer Bearer ${valid}`],
    ['not a jwt', 'Bearer not.a.jwt'],
  ];
  for (const [label, header] of malformed) {
    const response = await request(app)
      .get('/api/instructor/submissions')
      .set('Authorization', header);
    assert.equal(response.status, 401, `"${label}" was not rejected`);
  }
});

test('an admin token is forbidden on both role-scoped routes', async () => {
  for (const route of PROTECTED_ROUTES) {
    const response = await request(app).get(route).set('Authorization', `Bearer ${tokenFor('admin')}`);
    assert.equal(response.status, 403, `${route} let an admin through`);
    assert.equal(response.body.error, 'Forbidden');
  }
});

test('a token carrying no role claim is forbidden, not merely unauthorised', async () => {
  const roleless = jwt.sign({ sub: 'nobody' }, config.jwtSecret, { expiresIn: '8h' });
  const response = await request(app)
    .get('/api/instructor/submissions')
    .set('Authorization', `Bearer ${roleless}`);
  assert.equal(response.status, 403);
});

test('signUserToken puts sub, role and email in the payload and expires in 8h', async () => {
  const decoded = jwt.verify(tokenFor('student'), config.jwtSecret);
  assert.equal(decoded.sub, 'student-test');
  assert.equal(decoded.role, 'student');
  assert.equal(decoded.email, 'student@test.local');
  assert.equal(decoded.exp - decoded.iat, 8 * 60 * 60);
});

test('authentication is checked before role, and role before the database', async () => {
  // No DATABASE_URL is needed for either: a 401 or 403 must never reach requirePool().
  const anonymous = await request(app).get('/api/instructor/submissions');
  assert.equal(anonymous.status, 401);
  const wrongRole = await request(app)
    .get('/api/instructor/submissions')
    .set('Authorization', `Bearer ${tokenFor('student')}`);
  assert.equal(wrongRole.status, 403);
});
