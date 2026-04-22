-- Migration 004: WO shipping address fields + customer address book
-- Run: mysql -u root -p pands < db/migrations/004_wo_address.sql

ALTER TABLE work_orders
  ADD COLUMN ship_to_name VARCHAR(200),
  ADD COLUMN ship_addr1   VARCHAR(200),
  ADD COLUMN ship_addr2   VARCHAR(200),
  ADD COLUMN ship_city    VARCHAR(100),
  ADD COLUMN ship_state   VARCHAR(50),
  ADD COLUMN ship_zip     VARCHAR(20);

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
