ALTER TABLE raw_roll_lookup ADD COLUMN pebs TINYINT(1) NOT NULL DEFAULT 0;
INSERT INTO schema_migrations (migration) VALUES ('018_raw_roll_pebs') ON DUPLICATE KEY UPDATE migration = migration;
