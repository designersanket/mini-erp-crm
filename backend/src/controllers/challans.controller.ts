import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { generateChallanNumber } from '../utils/challanNumber';

interface ChallanItemInput {
  product_id: number;
  quantity: number;
}

export const listChallans = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '10', 10), 1), 100);
  const offset = (page - 1) * limit;

  const status = (req.query.status as string) || '';
  const customerId = (req.query.customer_id as string) || '';

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (status) {
    conditions.push('c.status = ?');
    params.push(status);
  }
  if (customerId) {
    conditions.push('c.customer_id = ?');
    params.push(customerId);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM challans c ${whereClause}`, params);
  const total = (countRows as { total: number }[])[0].total;

  const [rows] = await pool.query(
    `SELECT c.*, cu.name as customer_name, cu.mobile as customer_mobile
     FROM challans c
     JOIN customers cu ON cu.id = c.customer_id
     ${whereClause}
     ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const getChallan = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const [rows] = await pool.query(
    `SELECT c.*, cu.name as customer_name, cu.mobile as customer_mobile, cu.address as customer_address
     FROM challans c JOIN customers cu ON cu.id = c.customer_id WHERE c.id = ?`,
    [id]
  );
  const challan = (rows as unknown[])[0];
  if (!challan) throw ApiError.notFound('Challan not found');

  const [items] = await pool.query('SELECT * FROM challan_items WHERE challan_id = ?', [id]);

  res.json({ success: true, data: { ...(challan as object), items } });
});

// Create a challan (as Draft or Confirmed directly)
export const createChallan = asyncHandler(async (req: Request, res: Response) => {
  const { customer_id, items, status } = req.body as {
    customer_id: number;
    items: ChallanItemInput[];
    status?: 'draft' | 'confirmed';
  };

  if (!items || !items.length) {
    throw ApiError.badRequest('Challan must include at least one product line item');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [customerRows] = await conn.query('SELECT id FROM customers WHERE id = ?', [customer_id]);
    if (!(customerRows as unknown[])[0]) throw ApiError.badRequest('Customer does not exist');

    // Load product snapshots (and lock rows if we're about to confirm/reduce stock)
    const productIds = items.map((i) => i.product_id);
    const placeholders = productIds.map(() => '?').join(',');
    const lockClause = status === 'confirmed' ? 'FOR UPDATE' : '';
    const [productRows] = await conn.query(
      `SELECT * FROM products WHERE id IN (${placeholders}) ${lockClause}`,
      productIds
    );
    const products = productRows as { id: number; name: string; sku: string; unit_price: number; current_stock: number }[];

    if (products.length !== productIds.length) {
      throw ApiError.badRequest('One or more products do not exist');
    }
    const productMap = new Map(products.map((p) => [p.id, p]));

    // If confirming immediately, validate stock BEFORE writing anything
    if (status === 'confirmed') {
      for (const item of items) {
        const product = productMap.get(item.product_id)!;
        if (product.current_stock < item.quantity) {
          throw ApiError.badRequest(
            `Insufficient stock for "${product.name}" (SKU: ${product.sku}). Available: ${product.current_stock}, requested: ${item.quantity}`
          );
        }
      }
    }

    const challanNumber = await generateChallanNumber(conn);
    const totalQuantity = items.reduce((sum, i) => sum + Number(i.quantity), 0);
    const finalStatus = status === 'confirmed' ? 'confirmed' : 'draft';

    const [challanResult] = await conn.query(
      `INSERT INTO challans (challan_number, customer_id, status, total_quantity, created_by, confirmed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        challanNumber, customer_id, finalStatus, totalQuantity, req.user?.id || null,
        finalStatus === 'confirmed' ? new Date() : null,
      ]
    );
    const challanId = (challanResult as { insertId: number }).insertId;

    for (const item of items) {
      const product = productMap.get(item.product_id)!;
      // Snapshot product data at the moment it's added to the challan
      await conn.query(
        `INSERT INTO challan_items
          (challan_id, product_id, product_name_snapshot, product_sku_snapshot, unit_price_snapshot, quantity)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [challanId, product.id, product.name, product.sku, product.unit_price, item.quantity]
      );

      if (finalStatus === 'confirmed') {
        const newStock = product.current_stock - Number(item.quantity);
        await conn.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, product.id]);
        await conn.query(
          `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, reference_type, reference_id, created_by)
           VALUES (?, ?, 'OUT', ?, 'challan', ?, ?)`,
          [product.id, item.quantity, `Sales challan ${challanNumber}`, challanId, req.user?.id || null]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ success: true, data: { id: challanId, challan_number: challanNumber, status: finalStatus } });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// Replace items / customer on a DRAFT challan only
export const updateChallan = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { customer_id, items } = req.body as { customer_id?: number; items?: ChallanItemInput[] };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [challanRows] = await conn.query('SELECT * FROM challans WHERE id = ? FOR UPDATE', [id]);
    const challan = (challanRows as { status: string }[])[0];
    if (!challan) throw ApiError.notFound('Challan not found');
    if (challan.status !== 'draft') {
      throw ApiError.badRequest('Only draft challans can be edited. Confirmed/cancelled challans are locked.');
    }

    if (customer_id) {
      await conn.query('UPDATE challans SET customer_id = ? WHERE id = ?', [customer_id, id]);
    }

    if (items && items.length) {
      const productIds = items.map((i) => i.product_id);
      const placeholders = productIds.map(() => '?').join(',');
      const [productRows] = await conn.query(`SELECT * FROM products WHERE id IN (${placeholders})`, productIds);
      const products = productRows as { id: number; name: string; sku: string; unit_price: number }[];
      if (products.length !== productIds.length) throw ApiError.badRequest('One or more products do not exist');
      const productMap = new Map(products.map((p) => [p.id, p]));

      await conn.query('DELETE FROM challan_items WHERE challan_id = ?', [id]);
      const totalQuantity = items.reduce((sum, i) => sum + Number(i.quantity), 0);

      for (const item of items) {
        const product = productMap.get(item.product_id)!;
        await conn.query(
          `INSERT INTO challan_items
            (challan_id, product_id, product_name_snapshot, product_sku_snapshot, unit_price_snapshot, quantity)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, product.id, product.name, product.sku, product.unit_price, item.quantity]
        );
      }
      await conn.query('UPDATE challans SET total_quantity = ? WHERE id = ?', [totalQuantity, id]);
    }

    await conn.commit();
    res.json({ success: true, message: 'Challan updated' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// Confirm a draft challan: reduces stock, never lets stock go negative
export const confirmChallan = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [challanRows] = await conn.query('SELECT * FROM challans WHERE id = ? FOR UPDATE', [id]);
    const challan = (challanRows as { id: number; status: string; challan_number: string }[])[0];
    if (!challan) throw ApiError.notFound('Challan not found');
    if (challan.status !== 'draft') {
      throw ApiError.badRequest(`Only draft challans can be confirmed. Current status: ${challan.status}`);
    }

    const [itemRows] = await conn.query('SELECT * FROM challan_items WHERE challan_id = ?', [id]);
    const items = itemRows as { product_id: number; quantity: number }[];
    if (!items.length) throw ApiError.badRequest('Cannot confirm a challan with no line items');

    const productIds = items.map((i) => i.product_id);
    const placeholders = productIds.map(() => '?').join(',');
    const [productRows] = await conn.query(
      `SELECT * FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
      productIds
    );
    const products = productRows as { id: number; name: string; sku: string; current_stock: number }[];
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validate stock for every line BEFORE writing any change (atomic all-or-nothing)
    for (const item of items) {
      const product = productMap.get(item.product_id)!;
      if (product.current_stock < item.quantity) {
        throw ApiError.badRequest(
          `Insufficient stock for "${product.name}" (SKU: ${product.sku}). Available: ${product.current_stock}, requested: ${item.quantity}`
        );
      }
    }

    for (const item of items) {
      const product = productMap.get(item.product_id)!;
      const newStock = product.current_stock - Number(item.quantity);
      await conn.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, product.id]);
      await conn.query(
        `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, reference_type, reference_id, created_by)
         VALUES (?, ?, 'OUT', ?, 'challan', ?, ?)`,
        [product.id, item.quantity, `Sales challan ${challan.challan_number}`, id, req.user?.id || null]
      );
    }

    await conn.query('UPDATE challans SET status = ?, confirmed_at = ? WHERE id = ?', ['confirmed', new Date(), id]);

    await conn.commit();
    res.json({ success: true, message: 'Challan confirmed and stock updated' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// Cancel a draft challan (no stock impact) or a confirmed one (reverses stock)
export const cancelChallan = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [challanRows] = await conn.query('SELECT * FROM challans WHERE id = ? FOR UPDATE', [id]);
    const challan = (challanRows as { id: number; status: string; challan_number: string }[])[0];
    if (!challan) throw ApiError.notFound('Challan not found');
    if (challan.status === 'cancelled') throw ApiError.badRequest('Challan is already cancelled');

    if (challan.status === 'confirmed') {
      // Reverse the stock movement (restock)
      const [itemRows] = await conn.query('SELECT * FROM challan_items WHERE challan_id = ?', [id]);
      const items = itemRows as { product_id: number; quantity: number }[];
      for (const item of items) {
        await conn.query('UPDATE products SET current_stock = current_stock + ? WHERE id = ?', [
          item.quantity, item.product_id,
        ]);
        await conn.query(
          `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, reference_type, reference_id, created_by)
           VALUES (?, ?, 'IN', ?, 'challan', ?, ?)`,
          [item.product_id, item.quantity, `Reversal - cancelled challan ${challan.challan_number}`, id, req.user?.id || null]
        );
      }
    }

    await conn.query('UPDATE challans SET status = ?, cancelled_at = ? WHERE id = ?', ['cancelled', new Date(), id]);

    await conn.commit();
    res.json({ success: true, message: 'Challan cancelled' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});
