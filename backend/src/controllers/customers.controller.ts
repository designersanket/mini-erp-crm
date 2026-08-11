import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '10', 10), 1), 100);
  const offset = (page - 1) * limit;

  const search = (req.query.search as string) || '';
  const status = (req.query.status as string) || '';
  const customerType = (req.query.customer_type as string) || '';

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search) {
    conditions.push('(name LIKE ? OR mobile LIKE ? OR email LIKE ? OR business_name LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (customerType) {
    conditions.push('customer_type = ?');
    params.push(customerType);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM customers ${whereClause}`, params);
  const total = (countRows as { total: number }[])[0].total;

  const [rows] = await pool.query(
    `SELECT * FROM customers ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [id]);
  const customer = (rows as unknown[])[0];
  if (!customer) throw ApiError.notFound('Customer not found');

  const [notes] = await pool.query(
    `SELECT cn.*, u.name as created_by_name FROM customer_notes cn
     LEFT JOIN users u ON u.id = cn.created_by
     WHERE cn.customer_id = ? ORDER BY cn.created_at DESC`,
    [id]
  );

  res.json({ success: true, data: { ...(customer as object), notes } });
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const {
    name, mobile, email, business_name, gst_number,
    customer_type, address, status, followup_date, notes,
  } = req.body;

  const [result] = await pool.query(
    `INSERT INTO customers
      (name, mobile, email, business_name, gst_number, customer_type, address, status, followup_date, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name, mobile, email || null, business_name || null, gst_number || null,
      customer_type || 'retail', address || null, status || 'lead',
      followup_date || null, notes || null, req.user?.id || null,
    ]
  );
  const insertId = (result as { insertId: number }).insertId;
  res.status(201).json({ success: true, data: { id: insertId } });
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const allowedFields = [
    'name', 'mobile', 'email', 'business_name', 'gst_number',
    'customer_type', 'address', 'status', 'followup_date', 'notes',
  ];

  const updates: string[] = [];
  const values: unknown[] = [];
  for (const field of allowedFields) {
    if (field in req.body) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  if (!updates.length) throw ApiError.badRequest('No valid fields provided to update');

  values.push(id);
  const [result] = await pool.query(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, values);
  const affected = (result as { affectedRows: number }).affectedRows;
  if (!affected) throw ApiError.notFound('Customer not found');

  res.json({ success: true, message: 'Customer updated' });
});

export const addCustomerNote = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { note, followup_date } = req.body as { note: string; followup_date?: string };

  const [customerRows] = await pool.query('SELECT id FROM customers WHERE id = ?', [id]);
  if (!(customerRows as unknown[])[0]) throw ApiError.notFound('Customer not found');

  await pool.query(
    'INSERT INTO customer_notes (customer_id, note, followup_date, created_by) VALUES (?, ?, ?, ?)',
    [id, note, followup_date || null, req.user?.id || null]
  );

  if (followup_date) {
    await pool.query('UPDATE customers SET followup_date = ? WHERE id = ?', [followup_date, id]);
  }

  res.status(201).json({ success: true, message: 'Note added' });
});
