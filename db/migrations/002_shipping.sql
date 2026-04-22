-- Migration 002: Shipping + Customer tables
-- Run: mysql -u root -p pands < db/migrations/002_shipping.sql

CREATE TABLE IF NOT EXISTS customers (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  phone      VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE work_orders ADD COLUMN customer_id INT NULL,
  ADD CONSTRAINT fk_wo_customer FOREIGN KEY (customer_id) REFERENCES customers(id);

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
  production_run_id INT NOT NULL,
  sku_id            INT NOT NULL,
  rolls             INT NOT NULL,
  sqft              INT NOT NULL,
  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
  FOREIGN KEY (production_run_id) REFERENCES production_runs(id),
  FOREIGN KEY (sku_id) REFERENCES material_skus(id)
);
