/**
 * Seeds one demo login per role, plus a couple of sample customers/products
 * so the app isn't empty on first run.
 *
 * Usage: npm run seed   (after schema.sql has been applied)
 * All seeded users share the password: Password@123
 */
import bcrypt from 'bcryptjs';
import { pool } from '../config/db';

const DEMO_PASSWORD = 'Password@123';

async function upsertUser(name: string, email: string, role: string) {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role)`,
    [name, email, hash, role]
  );
  console.log(`  -> ${role.padEnd(10)} ${email}`);
}

async function seed() {
  console.log('Seeding demo users (password for all: Password@123)...');
  await upsertUser('Ashish Admin', 'admin@example.com', 'admin');
  await upsertUser('Sanya Sales', 'sales@example.com', 'sales');
  await upsertUser('Waseem Warehouse', 'warehouse@example.com', 'warehouse');
  await upsertUser('Amit Accounts', 'accounts@example.com', 'accounts');

  const [adminRows] = await pool.query('SELECT id FROM users WHERE email = ?', ['admin@example.com']);
  const adminId = (adminRows as { id: number }[])[0].id;

  console.log('Seeding sample products...');
  const products: [string, string, string, number, number, number, string][] = [
    ['Steel Hinges (Pack of 10)', 'SKU-HNG-010', 'Hardware', 120.0, 500, 50, 'Warehouse A'],
    ['PVC Pipe 2 inch (6m)', 'SKU-PVC-206', 'Plumbing', 340.5, 200, 30, 'Warehouse A'],
    ['LED Bulb 9W', 'SKU-LED-009', 'Electrical', 85.0, 1000, 100, 'Warehouse B'],
  ];
  for (const [name, sku, category, price, stock, minAlert, location] of products) {
    const [result] = await pool.query(
      `INSERT INTO products (name, sku, category, unit_price, current_stock, min_stock_alert, location)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [name, sku, category, price, stock, minAlert, location]
    );
    const insertId = (result as { insertId: number }).insertId;
    if (insertId) {
      await pool.query(
        `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, reference_type, created_by)
         VALUES (?, ?, 'IN', 'Opening stock (seed)', 'manual', ?)`,
        [insertId, stock, adminId]
      );
    }
    console.log(`  -> ${sku} ${name}`);
  }

  console.log('Seeding a sample customer...');
  await pool.query(
    `INSERT INTO customers (name, mobile, email, business_name, customer_type, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    ['Rajesh Traders', '9876543210', 'rajesh@example.com', 'Rajesh Traders Pvt Ltd', 'wholesale', 'active', adminId]
  );

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
