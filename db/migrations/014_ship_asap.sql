-- Migration 014: Add ship_asap flag to work_orders
-- (ship_date nullable was also added in 013; this guards against duplicate runs)
-- Run against existing pands database:
--   npm run migrate 014_ship_asap.sql

USE pands;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'work_orders'
    AND COLUMN_NAME  = 'ship_asap'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE work_orders ADD COLUMN ship_asap TINYINT(1) NOT NULL DEFAULT 0 AFTER ship_date',
  'SELECT 1 -- ship_asap already exists, skipping'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
