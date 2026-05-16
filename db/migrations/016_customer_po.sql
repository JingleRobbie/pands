-- Migration 016: Add customer_po to work_orders
-- Run against existing pands database:
--   npm run migrate 016_customer_po.sql

USE pands;

ALTER TABLE work_orders
  ADD COLUMN customer_po VARCHAR(100) NULL AFTER so_number;
