-- Mini ERP + CRM Operations Portal
-- MySQL schema
-- Run this once against a fresh database, e.g.:
--   mysql -u root -p mini_erp_crm < schema.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- USERS / AUTH
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','sales','warehouse','accounts') NOT NULL DEFAULT 'sales',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- CUSTOMERS (CRM)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  mobile         VARCHAR(20)  NOT NULL,
  email          VARCHAR(150) NULL,
  business_name  VARCHAR(150) NULL,
  gst_number     VARCHAR(30)  NULL,
  customer_type  ENUM('retail','wholesale','distributor') NOT NULL DEFAULT 'retail',
  address        TEXT NULL,
  status         ENUM('lead','active','inactive') NOT NULL DEFAULT 'lead',
  followup_date  DATE NULL,
  notes          TEXT NULL,
  created_by     INT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customers_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_customers_name (name),
  INDEX idx_customers_mobile (mobile),
  INDEX idx_customers_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Follow-up notes / activity log for a customer (many per customer)
CREATE TABLE IF NOT EXISTS customer_notes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  customer_id  INT NOT NULL,
  note         TEXT NOT NULL,
  followup_date DATE NULL,
  created_by   INT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notes_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- PRODUCTS / INVENTORY
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(150) NOT NULL,
  sku              VARCHAR(60)  NOT NULL UNIQUE,
  category         VARCHAR(100) NULL,
  unit_price       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  current_stock    INT NOT NULL DEFAULT 0,
  min_stock_alert  INT NOT NULL DEFAULT 0,
  location         VARCHAR(100) NULL,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_sku (sku),
  INDEX idx_products_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stock movement log - every IN/OUT is recorded here, current_stock on
-- products is a running total kept in sync inside a DB transaction.
CREATE TABLE IF NOT EXISTS stock_movements (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  product_id     INT NOT NULL,
  quantity       INT NOT NULL,
  movement_type  ENUM('IN','OUT') NOT NULL,
  reason         VARCHAR(255) NULL,
  reference_type VARCHAR(50) NULL,   -- e.g. 'challan', 'manual'
  reference_id   INT NULL,           -- e.g. challan id
  created_by     INT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movements_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_movements_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_movements_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- SALES CHALLANS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS challans (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  challan_number  VARCHAR(40) NOT NULL UNIQUE,
  customer_id     INT NOT NULL,
  status          ENUM('draft','confirmed','cancelled') NOT NULL DEFAULT 'draft',
  total_quantity  INT NOT NULL DEFAULT 0,
  created_by      INT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  confirmed_at    DATETIME NULL,
  cancelled_at    DATETIME NULL,
  CONSTRAINT fk_challans_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_challans_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_challans_status (status),
  INDEX idx_challans_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Line items store a SNAPSHOT of product name/sku/price at the time of
-- adding, so historical challans stay accurate even if the product is
-- later renamed or repriced. product_id is kept too, as a reference.
CREATE TABLE IF NOT EXISTS challan_items (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  challan_id          INT NOT NULL,
  product_id          INT NOT NULL,
  product_name_snapshot VARCHAR(150) NOT NULL,
  product_sku_snapshot  VARCHAR(60) NOT NULL,
  unit_price_snapshot   DECIMAL(12,2) NOT NULL,
  quantity            INT NOT NULL,
  CONSTRAINT fk_items_challan FOREIGN KEY (challan_id) REFERENCES challans(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_items_challan (challan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- SEED DATA (one login per role; password for all = Password@123)
-- Password hash below is a bcrypt hash generated at build time by
-- backend/src/db/seed.ts - running `npm run seed` will (re)insert this
-- data safely. These INSERTs are also here for convenience.
-- ---------------------------------------------------------------------
