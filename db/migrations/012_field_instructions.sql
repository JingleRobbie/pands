-- Add operator-editable field instructions separate from import-owned instructions.
-- Blank field_instructions falls back to original instructions in the UI.

USE pands;

ALTER TABLE work_order_lines
  ADD COLUMN field_instructions TEXT NULL AFTER instructions;

UPDATE work_order_lines
SET field_instructions = instructions
WHERE field_instructions IS NULL;
