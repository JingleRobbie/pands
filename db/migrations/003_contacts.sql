-- Migration 003: Simplify customers, add contacts table
-- Run: mysql -u root -p pands < db/migrations/003_contacts.sql

ALTER TABLE customers
  DROP COLUMN billing_street,
  DROP COLUMN billing_city,
  DROP COLUMN billing_state,
  DROP COLUMN billing_zip,
  DROP COLUMN shipping_street,
  DROP COLUMN shipping_city,
  DROP COLUMN shipping_state,
  DROP COLUMN shipping_zip,
  DROP COLUMN contact_name,
  DROP COLUMN email;

CREATE TABLE IF NOT EXISTS contacts (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  wo_id INT NOT NULL,
  name  VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(100),
  role  VARCHAR(50),
  FOREIGN KEY (wo_id) REFERENCES work_orders(id) ON DELETE CASCADE
);
