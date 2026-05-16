-- Migration 013: Add schema_migrations tracking table
-- Run against existing pands database:
--   mysql -u root -p pands < db/migrations/013_schema_migrations.sql

USE pands;

CREATE TABLE IF NOT EXISTS schema_migrations (
  migration  VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backfill all previously applied migrations
INSERT IGNORE INTO schema_migrations (migration) VALUES
  ('001_production_run_groups.sql'),
  ('002_shipping.sql'),
  ('003_contacts.sql'),
  ('004_wo_address.sql'),
  ('005_wo_accessories.sql'),
  ('006_wo_tab_type.sql'),
  ('007_ledger_inventory.sql'),
  ('008_inventory_effective_date.sql'),
  ('009_consumption_reversal.sql'),
  ('010_raw_roll_lookup.sql'),
  ('011_cut_down_number.sql'),
  ('012_field_instructions.sql');
