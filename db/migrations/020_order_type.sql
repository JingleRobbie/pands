ALTER TABLE work_orders
  ADD COLUMN order_type ENUM('STANDARD','STOCK','NON_PRODUCTION') NOT NULL DEFAULT 'STANDARD';

INSERT INTO schema_migrations (migration) VALUES ('020_order_type') ON DUPLICATE KEY UPDATE migration = migration;
