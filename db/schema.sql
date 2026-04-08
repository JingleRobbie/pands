-- PandS Inventory System — MySQL Schema
-- Run once: mysql -u root -p < db/schema.sql

CREATE DATABASE IF NOT EXISTS pands CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pands;

CREATE TABLE IF NOT EXISTS app_users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  display_name  VARCHAR(100) NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS material_skus (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  sku_code      VARCHAR(20) UNIQUE NOT NULL,   -- e.g. "3036"
  thickness_in  DECIMAL(2,1) NOT NULL,          -- display/ID only
  width_in      INT NOT NULL,          -- used in sq ft calc
  display_label VARCHAR(30) NOT NULL,            -- e.g. '3"×36"'
  sort_order    INT DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE
);

-- Append-only ledger of all sq ft movements
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  sku_id           INT NOT NULL,
  transaction_type ENUM('RECEIPT','CONSUMPTION','ADJUSTMENT_IN','ADJUSTMENT_OUT') NOT NULL,
  sqft_quantity    INT NOT NULL,   -- always positive
  reference_type   ENUM('PO_LINE','PRODUCTION_RUN','MANUAL') DEFAULT 'MANUAL',
  reference_id     INT,
  memo             TEXT,
  created_by       INT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sku_id) REFERENCES material_skus(id),
  FOREIGN KEY (created_by) REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  po_number     VARCHAR(50) UNIQUE NOT NULL,
  expected_date DATE NOT NULL,
  status        ENUM('OPEN','RECEIVED','CANCELLED') DEFAULT 'OPEN',
  created_by    INT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  po_id         INT NOT NULL,
  sku_id        INT NOT NULL,
  sqft_ordered  INT NOT NULL,
  sqft_received INT,
  status        ENUM('OPEN','RECEIVED','CANCELLED') DEFAULT 'OPEN',
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (sku_id) REFERENCES material_skus(id)
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  so_number VARCHAR(50) UNIQUE NOT NULL,
  job_name  VARCHAR(200) NOT NULL,
  ship_date DATE NOT NULL,
  status    ENUM('OPEN','IN_PROGRESS','COMPLETE','CANCELLED') DEFAULT 'OPEN',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS sales_order_lines (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  so_id         INT NOT NULL,
  sku_id        INT NOT NULL,
  sqft_ordered  INT NOT NULL,
  sqft_produced INT DEFAULT 0,
  UNIQUE KEY uq_so_sku (so_id, sku_id),
  FOREIGN KEY (so_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (sku_id) REFERENCES material_skus(id)
);

CREATE TABLE IF NOT EXISTS production_runs (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  run_number     VARCHAR(30) UNIQUE NOT NULL,
  so_line_id     INT NOT NULL,
  sku_id         INT NOT NULL,
  run_date       DATE,
  sqft_scheduled INT NOT NULL,
  sqft_actual    INT,
  status         ENUM('UNSCHEDULED','SCHEDULED','CONFIRMED') DEFAULT 'UNSCHEDULED',
  confirmed_at   TIMESTAMP NULL,
  confirmed_by   INT,
  created_by     INT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (so_line_id) REFERENCES sales_order_lines(id),
  FOREIGN KEY (sku_id) REFERENCES material_skus(id),
  FOREIGN KEY (confirmed_by) REFERENCES app_users(id),
  FOREIGN KEY (created_by) REFERENCES app_users(id)
);

-- Seed a default user (add more via MySQL directly or a future admin screen)
INSERT IGNORE INTO app_users (id, display_name) VALUES (1, 'Admin');
