-- Migration: bring existing DB up to current schema
-- Safe to run on an empty DB (tables have been reset).
-- Run: mysql -u root -p pands < db/migrate.sql

USE pands;

-- purchase_orders: add vendor_name
ALTER TABLE purchase_orders
  ADD COLUMN vendor_name ENUM('Johns Manville','Certainteed') NOT NULL DEFAULT 'Johns Manville';

-- sales_orders: add customer_name
ALTER TABLE sales_orders
  ADD COLUMN customer_name VARCHAR(200) NOT NULL DEFAULT '';

-- sales_order_lines: add facing
ALTER TABLE sales_order_lines
  ADD COLUMN facing VARCHAR(50) NOT NULL DEFAULT 'Faced';

-- production_runs: drop old FK, rename so_line_id → wo_line_id, add missing columns, fix status enum
ALTER TABLE production_runs
  DROP FOREIGN KEY production_runs_ibfk_1,
  CHANGE COLUMN so_line_id wo_line_id INT NOT NULL,
  ADD COLUMN group_id INT NULL AFTER run_number,
  ADD COLUMN rolls_scheduled INT NOT NULL DEFAULT 0,
  ADD COLUMN rolls_actual INT NULL,
  MODIFY COLUMN status ENUM('UNSCHEDULED','SCHEDULED','COMPLETED') DEFAULT 'UNSCHEDULED',
  ADD CONSTRAINT fk_pr_wo_line FOREIGN KEY (wo_line_id) REFERENCES work_order_lines(id),
  ADD CONSTRAINT fk_pr_group   FOREIGN KEY (group_id)   REFERENCES production_run_groups(id);

-- inventory_transactions: ensure INVENTORY_COUNT is in the reference_type enum
ALTER TABLE inventory_transactions
  MODIFY COLUMN reference_type ENUM('PO_LINE','PRODUCTION_RUN','MANUAL','INVENTORY_COUNT') DEFAULT 'MANUAL';

-- customers: new table
CREATE TABLE IF NOT EXISTS customers (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(200) NOT NULL,
  phone        VARCHAR(50)  NULL,
  contact_name VARCHAR(200) NULL,
  billing_city VARCHAR(100) NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- work_orders: add customer_id FK
ALTER TABLE work_orders
  ADD COLUMN customer_id INT NULL,
  ADD CONSTRAINT fk_wo_customer FOREIGN KEY (customer_id) REFERENCES customers(id);

-- shipments: new table
CREATE TABLE IF NOT EXISTS shipments (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  shipment_number  VARCHAR(50) NOT NULL,
  wo_id            INT NOT NULL,
  customer_id      INT NOT NULL,
  ship_date        DATE NOT NULL,
  status           ENUM('DRAFT','SHIPPED') DEFAULT 'DRAFT',
  created_by       INT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wo_id)       REFERENCES work_orders(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by)  REFERENCES app_users(id)
);

-- shipment_lines: new table
CREATE TABLE IF NOT EXISTS shipment_lines (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  shipment_id       INT NOT NULL,
  production_run_id INT NOT NULL,
  sku_id            INT NOT NULL,
  rolls             INT NOT NULL,
  sqft              INT NOT NULL,
  FOREIGN KEY (shipment_id)       REFERENCES shipments(id) ON DELETE CASCADE,
  FOREIGN KEY (production_run_id) REFERENCES production_runs(id),
  FOREIGN KEY (sku_id)            REFERENCES material_skus(id)
);
