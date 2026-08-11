import mysql from 'mysql2/promise';
import { env } from './env';

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

export async function testConnection(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    // eslint-disable-next-line no-console
    console.log(`[db] Connected to MySQL database "${env.db.name}" at ${env.db.host}:${env.db.port}`);
  } finally {
    conn.release();
  }
}
