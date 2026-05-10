-- PandS Inventory System - current MySQL schema
-- Fresh install:
--   mysql -u root -p < db/schema.sql
--   npm run seed

CREATE DATABASE IF NOT EXISTS pands CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pands;

CREATE TABLE IF NOT EXISTS app_users (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  display_name      VARCHAR(100) NOT NULL,
  is_active         BOOLEAN DEFAULT TRUE,
  sidebar_collapsed BOOLEAN NOT NULL DEFAULT FALSE,
  role              ENUM('admin','operator') NOT NULL DEFAULT 'operator',
  password_hash     VARCHAR(255) NULL
);

CREATE TABLE IF NOT EXISTS material_skus (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  sku_code      VARCHAR(20) UNIQUE NOT NULL,
  thickness_in  DECIMAL(2,1) NOT NULL,
  width_in      INT NOT NULL,
  display_label VARCHAR(30) NOT NULL,
  sort_order    INT DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS customers (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  phone      VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  customer_id  INT NOT NULL,
  nickname     VARCHAR(100) NOT NULL,
  ship_to_name VARCHAR(200),
  addr1        VARCHAR(200),
  addr2        VARCHAR(200),
  city         VARCHAR(100),
  state        VARCHAR(50),
  zip          VARCHAR(20),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  po_number     VARCHAR(50) UNIQUE NOT NULL,
  expected_date DATE NOT NULL,
  status        ENUM('OPEN','RECEIVED','CANCELLED') DEFAULT 'OPEN',
  created_by    INT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  vendor_name   ENUM('Johns Manville','Certainteed') DEFAULT NULL,
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


CREATE TABLE IF NOT EXISTS work_orders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  so_number     VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(200) NOT NULL DEFAULT '',
  job_name      VARCHAR(200) NOT NULL,
  branch        VARCHAR(50) NOT NULL DEFAULT '',
  ship_date     DATE NOT NULL,
  status        ENUM('OPEN','COMPLETE','CANCELLED') DEFAULT 'OPEN',
  created_by    INT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  customer_id   INT NULL,
  ship_to_name  VARCHAR(200),
  ship_addr1    VARCHAR(200),
  ship_addr2    VARCHAR(200),
  ship_city     VARCHAR(100),
  ship_state    VARCHAR(50),
  ship_zip      VARCHAR(20),
  FOREIGN KEY (created_by) REFERENCES app_users(id),
  CONSTRAINT fk_wo_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  wo_id INT NOT NULL,
  name  VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(100),
  role  VARCHAR(50),
  FOREIGN KEY (wo_id) REFERENCES work_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS work_order_lines (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  wo_id          INT NOT NULL,
  parent_line_id INT NULL,
  sku_id         INT NOT NULL,
  thickness_in   DECIMAL(4,1) NOT NULL DEFAULT 0.0,
  width_in       INT NOT NULL DEFAULT 0,
  qty            INT NOT NULL,
  length_ft      DECIMAL(8,2) NOT NULL,
  sqft           INT NOT NULL,
  rollfor        VARCHAR(50) NOT NULL DEFAULT '',
  facing         VARCHAR(50) NOT NULL DEFAULT '',
  instructions   TEXT,
  tab_type       VARCHAR(100) NULL,
  rolls_produced INT NOT NULL DEFAULT 0,
  path_type      ENUM('STANDARD','CUT_LAMINATE','CUT_SHIP','DIRECT_SHIP') NULL,
  reconciliation_status ENUM('CURRENT','STALE','RECONCILED','SUPERSEDED') NOT NULL DEFAULT 'CURRENT',
  FOREIGN KEY (wo_id) REFERENCES work_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_wol_parent FOREIGN KEY (parent_line_id) REFERENCES work_order_lines(id),
  FOREIGN KEY (sku_id) REFERENCES material_skus(id)
);

CREATE INDEX idx_wol_parent ON work_order_lines(parent_line_id);
CREATE INDEX idx_wol_reconciliation ON work_order_lines(wo_id, reconciliation_status);

CREATE TABLE IF NOT EXISTS wo_accessories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  wo_id       INT NOT NULL,
  qty         VARCHAR(20),
  part_number VARCHAR(100),
  description VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wo_id) REFERENCES work_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS production_run_groups (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS production_runs (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  run_number       VARCHAR(30) UNIQUE NOT NULL,
  group_id         INT NULL,
  wo_line_id       INT NOT NULL,
  rolls_scheduled  INT NOT NULL DEFAULT 0,
  sku_id           INT NOT NULL,
  run_date         DATE,
  sqft_scheduled   INT NOT NULL,
  sqft_actual      INT,
  rolls_actual     INT,
  status           ENUM('UNSCHEDULED','SCHEDULED','COMPLETED') DEFAULT 'UNSCHEDULED',
  confirmed_at     TIMESTAMP NULL,
  confirmed_by     INT,
  created_by       INT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pr_group FOREIGN KEY (group_id) REFERENCES production_run_groups(id),
  CONSTRAINT fk_pr_wo_line FOREIGN KEY (wo_line_id) REFERENCES work_order_lines(id),
  FOREIGN KEY (sku_id) REFERENCES material_skus(id),
  FOREIGN KEY (confirmed_by) REFERENCES app_users(id),
  FOREIGN KEY (created_by) REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS cut_down_groups (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  wo_id      INT NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wo_id) REFERENCES work_orders(id),
  FOREIGN KEY (created_by) REFERENCES app_users(id)
);

CREATE INDEX idx_cdg_wo ON cut_down_groups(wo_id);

CREATE TABLE IF NOT EXISTS cut_downs (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  cut_down_number   VARCHAR(30) UNIQUE NOT NULL,
  group_id          INT NULL,
  wo_id             INT NOT NULL,
  billing_line_id   INT NOT NULL,
  sku_id            INT NOT NULL,
  run_date          DATE NULL,
  status            ENUM('UNSCHEDULED','SCHEDULED','COMPLETED') NOT NULL DEFAULT 'UNSCHEDULED',
  rolls_scheduled   INT NOT NULL DEFAULT 0,
  sqft_scheduled    INT NOT NULL DEFAULT 0,
  rolls_actual      INT NULL,
  sqft_actual       INT NULL,
  waste_sqft_actual INT NULL,
  source_roll_count INT NULL,
  scrap_disposition ENUM('SAVED','DISCARDED','DELIVERED') NULL,
  operator_notes    TEXT NULL,
  confirmed_at      TIMESTAMP NULL,
  confirmed_by      INT NULL,
  created_by        INT NOT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cd_group FOREIGN KEY (group_id) REFERENCES cut_down_groups(id),
  CONSTRAINT fk_cd_wo FOREIGN KEY (wo_id) REFERENCES work_orders(id),
  CONSTRAINT fk_cd_billing_line FOREIGN KEY (billing_line_id) REFERENCES work_order_lines(id),
  CONSTRAINT fk_cd_sku FOREIGN KEY (sku_id) REFERENCES material_skus(id),
  CONSTRAINT fk_cd_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES app_users(id),
  CONSTRAINT fk_cd_created_by FOREIGN KEY (created_by) REFERENCES app_users(id)
);

CREATE INDEX idx_cd_wo ON cut_downs(wo_id);
CREATE INDEX idx_cd_billing_line ON cut_downs(billing_line_id);
CREATE INDEX idx_cd_group ON cut_downs(group_id);
CREATE INDEX idx_cd_status ON cut_downs(status);

CREATE TABLE IF NOT EXISTS wip_ledger (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  transaction_type ENUM('CUT_IN','CUT_OUT','SCRAP','ADJUSTMENT') NOT NULL,
  cut_down_id      INT NULL,
  wo_line_id       INT NULL,
  width_in         INT NOT NULL,
  sqft_quantity    INT NOT NULL,
  effective_date   DATE NOT NULL DEFAULT (CURDATE()),
  memo             TEXT NULL,
  created_by       INT NOT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wip_cut_down FOREIGN KEY (cut_down_id) REFERENCES cut_downs(id),
  CONSTRAINT fk_wip_wo_line FOREIGN KEY (wo_line_id) REFERENCES work_order_lines(id),
  CONSTRAINT fk_wip_created_by FOREIGN KEY (created_by) REFERENCES app_users(id)
);

CREATE INDEX idx_wip_cut_down ON wip_ledger(cut_down_id);
CREATE INDEX idx_wip_wo_line ON wip_ledger(wo_line_id);
CREATE INDEX idx_wip_effective ON wip_ledger(effective_date);
CREATE INDEX idx_wip_type ON wip_ledger(transaction_type);

CREATE TABLE IF NOT EXISTS shipments (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  shipment_number   VARCHAR(60) UNIQUE NOT NULL,
  wo_id             INT NOT NULL,
  customer_id       INT NOT NULL,
  ship_date         DATE NOT NULL,
  status            ENUM('DRAFT','SHIPPED') DEFAULT 'DRAFT',
  notes             TEXT,
  created_by        INT,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wo_id) REFERENCES work_orders(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by) REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS shipment_lines (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  shipment_id       INT NOT NULL,
  production_run_id INT NULL,
  cut_down_id       INT NULL,
  wo_line_id        INT NULL,
  sku_id            INT NOT NULL,
  rolls             INT NULL,
  sqft              INT NOT NULL,
  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
  FOREIGN KEY (production_run_id) REFERENCES production_runs(id),
  CONSTRAINT fk_sl_cut_down FOREIGN KEY (cut_down_id) REFERENCES cut_downs(id),
  CONSTRAINT fk_sl_wo_line FOREIGN KEY (wo_line_id) REFERENCES work_order_lines(id),
  CONSTRAINT chk_sl_one_source CHECK (
    (production_run_id IS NOT NULL) +
    (cut_down_id IS NOT NULL) +
    (wo_line_id IS NOT NULL) = 1
  ),
  FOREIGN KEY (sku_id) REFERENCES material_skus(id)
);

CREATE INDEX idx_sl_cut_down ON shipment_lines(cut_down_id);
CREATE INDEX idx_sl_wo_line ON shipment_lines(wo_line_id);

CREATE TABLE IF NOT EXISTS inventory_counts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  memo       VARCHAR(255),
  count_date DATE NOT NULL DEFAULT (CURDATE()),
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  sku_id           INT NOT NULL,
  transaction_type ENUM('RECEIPT','RECEIPT_REVERSAL','CONSUMPTION','CONSUMPTION_REVERSAL','ADJUSTMENT_IN','ADJUSTMENT_OUT') NOT NULL,
  sqft_quantity    INT NOT NULL,
  counted_sqft     INT NULL,
  effective_date    DATE NOT NULL DEFAULT (CURDATE()),
  reference_type   ENUM('PO_LINE','PRODUCTION_RUN','MANUAL','INVENTORY_COUNT','CUT_DOWN') DEFAULT 'MANUAL',
  reference_id     INT,
  reverses_transaction_id INT NULL,
  memo             TEXT,
  created_by       INT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sku_id) REFERENCES material_skus(id),
  FOREIGN KEY (reverses_transaction_id) REFERENCES inventory_transactions(id),
  FOREIGN KEY (created_by) REFERENCES app_users(id),
  INDEX idx_inventory_transactions_sku_effective (sku_id, effective_date),
  INDEX idx_inventory_transactions_sku_created (sku_id, created_at),
  INDEX idx_inventory_transactions_reference (reference_type, reference_id)
);

INSERT IGNORE INTO app_users (id, display_name, role) VALUES (1, 'Admin', 'admin');
