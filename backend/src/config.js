import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 8000),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'development-only-secret',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
};