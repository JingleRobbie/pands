-- Migration 014: Add ship_asap flag to work_orders
-- Run against existing pands database:
--   npm run migrate 014_ship_asap.sql

USE pands;

ALTER TABLE work_orders
  ADD COLUMN ship_asap TINYINT(1) NOT NULL DEFAULT 0 AFTER ship_date;
