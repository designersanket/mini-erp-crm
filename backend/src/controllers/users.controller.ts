import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
  const [rows] = await pool.query(
    'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ success: true, data: rows });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body as {
    name: string;
    email: string;
    password: string;
    role: string;
  };

  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, email, hash, role]
  );
  const insertId = (result as { insertId: number }).insertId;

  res.status(201).json({
    success: true,
    data: { id: insertId, name, email, role },
  });
});

export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const [result] = await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
  const affected = (result as { affectedRows: number }).affectedRows;
  if (!affected) throw ApiError.notFound('User not found');
  res.json({ success: true, message: 'User deactivated' });
});
