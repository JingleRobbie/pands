-- Add production consumption reversals for unproduce corrections.
-- Run after 008_inventory_effective_date.sql on existing installs.

USE pands;

ALTER TABLE inventory_transactions
  MODIFY transaction_type ENUM('RECEIPT','RECEIPT_REVERSAL','CONSUMPTION','CONSUMPTION_REVERSAL','ADJUSTMENT_IN','ADJUSTMENT_OUT') NOT NULL;
