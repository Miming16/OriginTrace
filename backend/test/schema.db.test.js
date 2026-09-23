// WBS 0.3.x / 1.3 -- schema and migration verification.
//
// Asserts that db/migrations/001_initial_schema.sql, applied to a real
// PostgreSQL server, produces exactly the tables, foreign keys, CHECK
// constraints, indexes and unique constraints it declares -- and that the
// behaviour those constraints promise (role rejection, cascade delete,
// gen_random_uuid) actually holds.
//
// Skipped automatically when DATABASE_URL is unset, so `npm test` stays green
// without a database.

import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import pg from 'pg';

const skip = process.env.DATABASE_URL ? false : 'DATABASE_URL is not set';
const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : null;

after(async () => {
  if (pool) await pool.end();
});

const EXPECTED_TABLES = [
  'commit_signals',
  'enrollments',
  'fingerprints',
  'originality_decisions',
  'provenance_flags',
  'risk_scores',
  'similarity_cluster_members',
  'similarity_clusters',
  'subjects',
  'submissions',
  'users',
];

// [table, column, referenced table, on-delete rule]
const EXPECTED_FOREIGN_KEYS = [
  ['submissions', 'student_id', 'users', 'CASCADE'],
  ['fingerprints', 'submission_id', 'submissions', 'CASCADE'],
  ['commit_signals', 'submission_id', 'submissions', 'CASCADE'],
  ['provenance_flags', 'submission_id', 'submissions', 'CASCADE'],
  ['risk_scores', 'submission_id', 'submissions', 'CASCADE'],
  ['similarity_cluster_members', 'cluster_id', 'similarity_clusters', 'CASCADE'],
  ['similarity_cluster_members', 'submission_id', 'submissions', 'CASCADE'],
  ['originality_decisions', 'submission_id', 'submissions', 'CASCADE'],
  ['originality_decisions', 'instructor_id', 'users', 'NO ACTION'],
  ['subjects', 'instructor_id', 'users', 'CASCADE'],
  ['enrollments', 'student_id', 'users', 'CASCADE'],
  ['enrollments', 'subject_id', 'subjects', 'CASCADE'],
  ['submissions', 'subject_id', 'subjects', 'SET NULL'],
];

// [table, distinctive fragment of the CHECK expression]
const EXPECTED_CHECKS = [
  ['users', "role"],
  ['users', 'users_email_not_blank'],
  ['users', 'users_id_number_not_blank'],
  ['users', 'users_full_name_not_blank'],
  ['submissions', 'source_type'],
  ['submissions', 'language'],
  ['submissions', 'status'],
  ['submissions', 'submissions_source_url_not_blank'],
  ['fingerprints', 'window_position'],
  ['commit_signals', 'signal_type'],
  ['commit_signals', 'severity'],
  ['provenance_flags', 'flag_type'],
  ['provenance_flags', 'severity'],
  ['risk_scores', 'risk_band'],
  ['risk_scores', 'risk_scores_similarity_nonnegative'],
  ['risk_scores', 'risk_scores_commit_flags_nonnegative'],
  ['risk_scores', 'risk_scores_provenance_flags_nonnegative'],
  ['similarity_clusters', 'similarity_score'],
  ['originality_decisions', 'decision'],
];

const EXPECTED_INDEXES = [
  'idx_users_role',
  'idx_submissions_student',
  'idx_submissions_status',
  'idx_submissions_submitted_at',
  'idx_submissions_self_check',
  'idx_fingerprints_submission',
  'idx_fingerprints_hash',
  'idx_commit_signals_submission',
  'idx_provenance_flags_submission',
  'idx_risk_scores_band',
  'idx_cluster_members_submission',
  'idx_decisions_instructor',
];

test('migration creates exactly the tables it declares', { skip }, async () => {
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  );
  assert.deepEqual(rows.map((row) => row.table_name), EXPECTED_TABLES);
});

test('every foreign key declared in the migration exists with its delete rule', { skip }, async () => {
  const { rows } = await pool.query(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);
  const actual = new Set(
    rows.map((r) => `${r.table_name}.${r.column_name}->${r.references_table}:${r.delete_rule}`),
  );
  for (const [table, column, references, rule] of EXPECTED_FOREIGN_KEYS) {
    assert.ok(
      actual.has(`${table}.${column}->${references}:${rule}`),
      `missing FK ${table}.${column} -> ${references} ON DELETE ${rule}`,
    );
  }
  assert.equal(actual.size, EXPECTED_FOREIGN_KEYS.length, 'unexpected extra foreign keys');
});

test('every CHECK constraint declared in the migration exists', { skip }, async () => {
  const { rows } = await pool.query(`
    SELECT rel.relname AS table_name, con.conname, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE con.contype = 'c' AND ns.nspname = 'public'
  `);
  for (const [table, fragment] of EXPECTED_CHECKS) {
    assert.ok(
      rows.some(
        (r) => r.table_name === table && (r.conname === fragment || r.definition.includes(fragment)),
      ),
      `missing CHECK on ${table} matching "${fragment}"`,
    );
  }
});

test('every index declared in the migration exists', { skip }, async () => {
  const { rows } = await pool.query(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'",
  );
  const actual = new Set(rows.map((r) => r.indexname));
  for (const name of EXPECTED_INDEXES) {
    assert.ok(actual.has(name), `missing index ${name}`);
  }
});

test('the partial self-check index carries its WHERE clause', { skip }, async () => {
  const { rows } = await pool.query(
    "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_submissions_self_check'",
  );
  assert.equal(rows.length, 1);
  assert.match(rows[0].indexdef, /WHERE \(is_self_check = true\)/);
});

test('unique constraints declared in the migration exist', { skip }, async () => {
  const { rows } = await pool.query(`
    SELECT rel.relname AS table_name, con.contype, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE con.contype IN ('u', 'p') AND ns.nspname = 'public'
  `);
  const has = (table, definition) =>
    rows.some((r) => r.table_name === table && r.definition === definition);
  assert.ok(has('users', 'UNIQUE (email)'), 'users.email must be UNIQUE');
  assert.ok(has('users', 'UNIQUE (id_number)'), 'users.id_number must be UNIQUE');
  assert.ok(has('risk_scores', 'UNIQUE (submission_id)'), 'one risk score per submission');
  assert.ok(
    has('originality_decisions', 'UNIQUE (submission_id)'),
    'one originality decision per submission',
  );
  assert.ok(
    has('similarity_cluster_members', 'PRIMARY KEY (cluster_id, submission_id)'),
    'cluster membership must be a composite primary key',
  );
});

test('gen_random_uuid() is available and yields distinct version-4 uuids', { skip }, async () => {
  const { rows } = await pool.query('SELECT gen_random_uuid() AS a, gen_random_uuid() AS b');
  const { a, b } = rows[0];
  assert.notEqual(a, b);
  for (const value of [a, b]) {
    assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  }
});

test('users.role rejects a value outside the CHECK constraint', { skip }, async () => {
  await assert.rejects(
    () =>
      pool.query(
        `INSERT INTO users (id_number, email, password_hash, role, full_name)
         VALUES ('2023018087', 'bad-role@origintrace.test', 'x', 'superuser', 'Bad Role')`,
      ),
    (error) => {
      assert.equal(error.code, '23514', 'expected a check_violation');
      assert.match(error.constraint, /role/);
      return true;
    },
  );
});

test('deleting a user cascades to submissions, fingerprints and risk scores', { skip }, async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [user] } = await client.query(
      `INSERT INTO users (id_number, email, password_hash, role, full_name)
       VALUES ('2023018090', 'cascade@origintrace.test', 'x', 'student', 'Cascade Probe') RETURNING id`,
    );
    const { rows: [submission] } = await client.query(
      `INSERT INTO submissions (student_id, source_type, source_url, language)
       VALUES ($1, 'git', 'https://example.test/repo.git', 'python') RETURNING id`,
      [user.id],
    );
    await client.query(
      `INSERT INTO fingerprints (submission_id, file_path, hash_value, window_position)
       VALUES ($1, 'src/a.py', 42, 0)`,
      [submission.id],
    );
    await client.query(
      `INSERT INTO risk_scores (submission_id, risk_band, similarity_score)
       VALUES ($1, 'low', 0.1)`,
      [submission.id],
    );

    await client.query('DELETE FROM users WHERE id = $1', [user.id]);

    for (const [table, column] of [
      ['submissions', 'id'],
      ['fingerprints', 'submission_id'],
      ['risk_scores', 'submission_id'],
    ]) {
      const { rows } = await client.query(
        `SELECT count(*)::int AS n FROM ${table} WHERE ${column} = $1`,
        [submission.id],
      );
      assert.equal(rows[0].n, 0, `${table} rows survived the cascade`);
    }
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

// --- Evidence for defects, not aspirations. -----------------------------------

test('DEFECT D-01: submissions.language accepts javascript and rejects java', { skip }, async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [user] } = await client.query(
      `INSERT INTO users (id_number, email, password_hash, role, full_name)
       VALUES ('2023018089', 'lang@origintrace.test', 'x', 'student', 'Language Probe') RETURNING id`,
    );
    const insert = (language) =>
      client.query(
        `INSERT INTO submissions (student_id, source_type, source_url, language)
         VALUES ($1, 'git', 'https://example.test/repo.git', $2)`,
        [user.id, language],
      );

    // The schema allows a language the analysis service cannot parse...
    await client.query('SAVEPOINT probe');
    await insert('javascript');
    await client.query('ROLLBACK TO SAVEPOINT probe');

    // ...and rejects one the analysis service does support.
    await assert.rejects(() => insert('java'), (error) => {
      assert.equal(error.code, '23514');
      return true;
    });
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('DEFECT D-02: fingerprints.hash_value is signed BIGINT and rejects 2^63 and above', { skip }, async () => {
  const { rows } = await pool.query(`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'fingerprints' AND column_name = 'hash_value'
  `);
  assert.equal(rows[0].data_type, 'bigint');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [user] } = await client.query(
      `INSERT INTO users (id_number, email, password_hash, role, full_name)
       VALUES ('2023018088', 'overflow@origintrace.test', 'x', 'student', 'Overflow Probe') RETURNING id`,
    );
    const { rows: [submission] } = await client.query(
      `INSERT INTO submissions (student_id, source_type, source_url, language)
       VALUES ($1, 'git', 'https://example.test/repo.git', 'python') RETURNING id`,
      [user.id],
    );
    // pipeline.winnow() produces unsigned 64-bit hashes: int(sha256[:16], 16).
    // Half of that range does not fit a signed BIGINT column.
    await assert.rejects(
      () =>
        client.query(
          `INSERT INTO fingerprints (submission_id, file_path, hash_value, window_position)
           VALUES ($1, 'src/a.py', '9223372036854775808', 0)`,
          [submission.id],
        ),
      (error) => {
        assert.equal(error.code, '22003', 'expected numeric_value_out_of_range');
        return true;
      },
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});
