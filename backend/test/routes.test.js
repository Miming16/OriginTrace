import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { signUserToken } from '../src/auth.js';
import { app } from '../src/app.js';

const tokenFor = (role) =>  signUserToken({ id: '00000000-0000-0000-0000-000000000000', role, email: `${role}@test.local` });
test('health endpoint is public', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
});

test('instructor route rejects unauthenticated requests', async () => {
  const response = await request(app).get('/api/instructor/submissions');
  assert.equal(response.status, 401);
});

test('instructor route rejects student tokens before database access', async () => {
  const response = await request(app)
    .get('/api/instructor/submissions')
    .set('Authorization', `Bearer ${tokenFor('student')}`);
  assert.equal(response.status, 403);
});

test('student quota route rejects instructor tokens', async () => {
  const response = await request(app)
    .get('/api/student/self-checks/quota')
    .set('Authorization', `Bearer ${tokenFor('instructor')}`);
  assert.equal(response.status, 403);
});

test('student quota route accepts student tokens', async () => {
  const response = await request(app)
    .get('/api/student/self-checks/quota')
    .set('Authorization', `Bearer ${tokenFor('student')}`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { limit: 3, used: 0, remaining: 3, window: 'daily' });
});

test('admin subject creation requires a supported semester', async () => {
  const response = await request(app)
    .post('/api/admin/subjects')
    .set('Authorization', `Bearer ${tokenFor('admin')}`)
    .send({
      subject_code: 'CS101',
      subject_title: 'Introduction to Programming',
      school_year: '2027-28',
      semester: 'summer',
      instructor_id: '00000000-0000-0000-0000-000000000000',
    });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /school_year/);
});