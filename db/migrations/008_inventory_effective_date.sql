-- Add inventory transaction effective dates for historical/as-of accuracy.
-- Run after 007_ledger_inventory.sql on existing installs.

USE pands;

ALTER TABLE inventory_transactions
  ADD COLUMN effective_date DATE NULL AFTER counted_sqft,
  ADD INDEX idx_inventory_transactions_sku_effective (sku_id, effective_date);

UPDATE inventory_transactions it
LEFT JOIN production_runs pr
  ON it.reference_type = 'PRODUCTION_RUN' AND pr.id = it.reference_id
LEFT JOIN inventory_counts ic
  ON it.reference_type = 'INVENTORY_COUNT' AND ic.id = it.reference_id
SET it.effective_date = CASE
  WHEN it.reference_type = 'INVENTORY_COUNT' THEN ic.count_date
  WHEN it.reference_type = 'PRODUCTION_RUN' THEN COALESCE(pr.run_date, DATE(it.created_at))
  ELSE DATE(it.created_at)
END;

UPDATE inventory_transactions reversal
JOIN inventory_transactions receipt
  ON receipt.id = reversal.reverses_transaction_id
SET reversal.effective_date = receipt.effective_date
WHERE reversal.transaction_type = 'RECEIPT_REVERSAL';

ALTER TABLE inventory_transactions
  MODIFY effective_date DATE NOT NULL;
