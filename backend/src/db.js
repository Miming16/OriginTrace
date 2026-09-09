import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = config.databaseUrl
  ? new Pool({ connectionString: config.databaseUrl })
  : null;

export function requirePool() {
  if (!pool) {
    const error = new Error('DATABASE_URL is not configured');
    error.status = 503;
    throw error;
  }
  return pool;
}