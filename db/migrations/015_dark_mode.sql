-- Migration 015: Add dark_mode preference to app_users
-- Run against existing pands database:
--   npm run migrate 015_dark_mode.sql

USE pands;

ALTER TABLE app_users
  ADD COLUMN dark_mode TINYINT(1) NOT NULL DEFAULT 0 AFTER sidebar_collapsed;
