-- Add stable cut-down numbers required by the cut-down service.
-- Run after 010_raw_roll_lookup.sql on existing installs that predate cut-down numbers.

USE pands;

ALTER TABLE cut_downs
  ADD COLUMN cut_down_number VARCHAR(30) NULL AFTER id;

UPDATE cut_downs
SET cut_down_number = CONCAT('CD-', LPAD(id, 6, '0'))
WHERE cut_down_number IS NULL;

ALTER TABLE cut_downs
  MODIFY cut_down_number VARCHAR(30) NOT NULL,
  ADD UNIQUE KEY uq_cut_down_number (cut_down_number);
