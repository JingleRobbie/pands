ALTER TABLE material_skus ADD COLUMN pebs TINYINT(1) NOT NULL DEFAULT 0;
INSERT INTO schema_migrations (migration) VALUES ('017_pebs') ON DUPLICATE KEY UPDATE migration = migration;
