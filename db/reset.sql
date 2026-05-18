-- Reset script: clears all transactional data while preserving app_users and material_skus.
-- Run: mysql -u root -p pands < db/reset.sql

USE pands;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE contacts;
TRUNCATE TABLE customer_addresses;
TRUNCATE TABLE customers;
TRUNCATE TABLE cut_down_groups;
TRUNCATE TABLE cut_downs;
TRUNCATE TABLE inventory_counts;
TRUNCATE TABLE inventory_transactions;
TRUNCATE TABLE production_run_groups;
TRUNCATE TABLE production_runs;
TRUNCATE TABLE purchase_order_lines;
TRUNCATE TABLE purchase_orders;
TRUNCATE TABLE shipment_lines;
TRUNCATE TABLE shipments;
TRUNCATE TABLE wip_ledger;
TRUNCATE TABLE wo_accessories;
TRUNCATE TABLE work_order_lines;
TRUNCATE TABLE work_orders;

SET FOREIGN_KEY_CHECKS = 1;
