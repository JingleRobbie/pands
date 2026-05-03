-- Align inventory balances to the transaction ledger.
-- Run after 006_wo_tab_type.sql on existing installs.

USE pands;

ALTER TABLE inventory_transactions
  MODIFY transaction_type ENUM('RECEIPT','RECEIPT_REVERSAL','CONSUMPTION','ADJUSTMENT_IN','ADJUSTMENT_OUT') NOT NULL;

ALTER TABLE inventory_transactions
  ADD COLUMN reverses_transaction_id INT NULL AFTER reference_id,
  ADD INDEX idx_inventory_transactions_sku_created (sku_id, created_at),
  ADD INDEX idx_inventory_transactions_reference (reference_type, reference_id),
  ADD CONSTRAINT fk_inventory_transactions_reversal
    FOREIGN KEY (reverses_transaction_id) REFERENCES inventory_transactions(id);

-- Older data may have received PO lines without matching RECEIPT ledger rows
-- because balances were previously derived partly from PO tables.
INSERT INTO inventory_transactions
  (sku_id, transaction_type, sqft_quantity, reference_type, reference_id, memo, created_by, created_at)
SELECT
  pol.sku_id,
  'RECEIPT',
  COALESCE(pol.sqft_received, pol.sqft_ordered),
  'PO_LINE',
  pol.id,
  CONCAT('Backfilled receipt for PO ', po.po_number),
  po.created_by,
  CAST(po.expected_date AS DATETIME)
FROM purchase_order_lines pol
JOIN purchase_orders po ON po.id = pol.po_id
WHERE pol.status = 'RECEIVED'
  AND po.status != 'CANCELLED'
  AND COALESCE(pol.sqft_received, pol.sqft_ordered) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM inventory_transactions it
    WHERE it.reference_type = 'PO_LINE'
      AND it.reference_id = pol.id
      AND it.transaction_type = 'RECEIPT'
  );
