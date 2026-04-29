-- Reset script: clears all transactional data while preserving app_users and material_skus.
-- Run: mysql -u root -p pands < db/reset.sql

USE pands;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE inventory_transactions;
TRUNCATE TABLE inventory_counts;
TRUNCATE TABLE production_runs;
TRUNCATE TABLE production_run_groups;
TRUNCATE TABLE work_order_lines;
TRUNCATE TABLE work_orders;
TRUNCATE TABLE purchase_order_lines;
TRUNCATE TABLE purchase_orders;
TRUNCATE TABLE sales_order_lines;
TRUNCATE TABLE sales_orders;

SET FOREIGN_KEY_CHECKS = 1;