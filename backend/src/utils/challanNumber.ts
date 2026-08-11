import { PoolConnection } from 'mysql2/promise';

/**
 * Generates a challan number like CH-2026-000123.
 * Uses the yearly count of existing challans + 1, computed inside the
 * same transaction/connection to reduce (not fully eliminate, without a
 * dedicated sequence table) race conditions under concurrent writes.
 */
export async function generateChallanNumber(conn: PoolConnection): Promise<string> {
  const year = new Date().getFullYear();
  const [rows] = await conn.query(
    `SELECT COUNT(*) as count FROM challans WHERE challan_number LIKE ?`,
    [`CH-${year}-%`]
  );
  const count = (rows as { count: number }[])[0].count;
  const next = (count + 1).toString().padStart(6, '0');
  return `CH-${year}-${next}`;
}
