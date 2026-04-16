-- Migration 001: Add production_run_groups and group_id to production_runs
-- Run against existing pands database:
--   mysql -u root -p pands < db/migrations/001_production_run_groups.sql

USE pands;

CREATE TABLE IF NOT EXISTS production_run_groups (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES app_users(id)
);

ALTER TABLE production_runs
  ADD COLUMN group_id INT NULL AFTER run_number,
  ADD CONSTRAINT fk_pr_group FOREIGN KEY (group_id) REFERENCES production_run_groups(id);
