ALTER TABLE raw_roll_lookup DROP INDEX uq_raw_roll;
ALTER TABLE raw_roll_lookup ADD UNIQUE KEY uq_raw_roll (vendor, thickness_in, width_in, pebs);
INSERT INTO schema_migrations (migration) VALUES ('019_raw_roll_unique') ON DUPLICATE KEY UPDATE migration = migration;
