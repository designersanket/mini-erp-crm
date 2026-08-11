import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '10', 10), 1), 100);
  const offset = (page - 1) * limit;

  const search = (req.query.search as string) || '';
  const category = (req.query.category as string) || '';
  const lowStock = req.query.low_stock === 'true';

  const conditions: string[] = ['is_active = 1'];
  const params: unknown[] = [];

  if (search) {
    conditions.push('(name LIKE ? OR sku LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (lowStock) {
    conditions.push('current_stock <= min_stock_alert');
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM products ${whereClause}`, params);
  const total = (countRows as { total: number }[])[0].total;

  const [rows] = await pool.query(
    `SELECT * FROM products ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
  const product = (rows as unknown[])[0];
  if (!product) throw ApiError.notFound('Product not found');
  res.json({ success: true, data: product });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const { name, sku, category, unit_price, current_stock, min_stock_alert, location } = req.body;

  const [result] = await pool.query(
    `INSERT INTO products (name, sku, category, unit_price, current_stock, min_stock_alert, location)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, sku, category || null, unit_price, current_stock || 0, min_stock_alert || 0, location || null]
  );
  const insertId = (result as { insertId: number }).insertId;

  if (current_stock && Number(current_stock) > 0) {
    await pool.query(
      `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, reference_type, created_by)
       VALUES (?, ?, 'IN', 'Opening stock', 'manual', ?)`,
      [insertId, current_stock, req.user?.id || null]
    );
  }

  res.status(201).json({ success: true, data: { id: insertId } });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const allowedFields = ['name', 'sku', 'category', 'unit_price', 'min_stock_alert', 'location', 'is_active'];

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
  const [result] = await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);
  const affected = (result as { affectedRows: number }).affectedRows;
  if (!affected) throw ApiError.notFound('Product not found');

  res.json({ success: true, message: 'Product updated' });
});

export const listMovements = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const [rows] = await pool.query(
    `SELECT sm.*, u.name as created_by_name FROM stock_movements sm
     LEFT JOIN users u ON u.id = sm.created_by
     WHERE sm.product_id = ? ORDER BY sm.created_at DESC`,
    [id]
  );
  res.json({ success: true, data: rows });
});

// Manual stock adjustment (warehouse/admin) - e.g. stock correction, damage, purchase receipt
export const addMovement = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { quantity, movement_type, reason } = req.body as {
    quantity: number; movement_type: 'IN' | 'OUT'; reason?: string;
  };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [id]);
    const product = (rows as { current_stock: number }[])[0];
    if (!product) throw ApiError.notFound('Product not found');

    if (movement_type === 'OUT' && product.current_stock < quantity) {
      throw ApiError.badRequest(
        `Insufficient stock. Available: ${product.current_stock}, requested: ${quantity}`
      );
    }

    const newStock = movement_type === 'IN'
      ? product.current_stock + Number(quantity)
      : product.current_stock - Number(quantity);

    await conn.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, id]);
    await conn.query(
      `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, reference_type, created_by)
       VALUES (?, ?, ?, ?, 'manual', ?)`,
      [id, quantity, movement_type, reason || null, req.user?.id || null]
    );

    await conn.commit();
    res.status(201).json({ success: true, message: 'Stock movement recorded', data: { new_stock: newStock } });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});
