-- ============================================================
-- PandS Sample Data - Purchase Orders + Opening Inventory
-- Run: mysql -u root -p pands < scripts/seed-sample-data.sql
-- ============================================================

-- ============================================================
-- 1. STARTING INVENTORY (Apr 7 - pre-history baseline)
-- ============================================================

INSERT INTO inventory_transactions
  (sku_id, transaction_type, sqft_quantity, reference_type, memo, created_by, created_at)
VALUES
  ((SELECT id FROM material_skus WHERE sku_code='3036'), 'ADJUSTMENT_IN', 4200, 'MANUAL', 'Opening inventory', 1, '2026-04-07 06:00:00'),
  ((SELECT id FROM material_skus WHERE sku_code='3048'), 'ADJUSTMENT_IN', 8500, 'MANUAL', 'Opening inventory', 1, '2026-04-07 06:00:00'),
  ((SELECT id FROM material_skus WHERE sku_code='3072'), 'ADJUSTMENT_IN', 3100, 'MANUAL', 'Opening inventory', 1, '2026-04-07 06:00:00'),
  ((SELECT id FROM material_skus WHERE sku_code='4048'), 'ADJUSTMENT_IN', 6800, 'MANUAL', 'Opening inventory', 1, '2026-04-07 06:00:00'),
  ((SELECT id FROM material_skus WHERE sku_code='4072'), 'ADJUSTMENT_IN', 2400, 'MANUAL', 'Opening inventory', 1, '2026-04-07 06:00:00'),
  ((SELECT id FROM material_skus WHERE sku_code='6036'), 'ADJUSTMENT_IN', 5600, 'MANUAL', 'Opening inventory', 1, '2026-04-07 06:00:00'),
  ((SELECT id FROM material_skus WHERE sku_code='6048'), 'ADJUSTMENT_IN', 9200, 'MANUAL', 'Opening inventory', 1, '2026-04-07 06:00:00'),
  ((SELECT id FROM material_skus WHERE sku_code='6060'), 'ADJUSTMENT_IN', 1800, 'MANUAL', 'Opening inventory', 1, '2026-04-07 06:00:00'),
  ((SELECT id FROM material_skus WHERE sku_code='6072'), 'ADJUSTMENT_IN', 4100, 'MANUAL', 'Opening inventory', 1, '2026-04-07 06:00:00');

-- ============================================================
-- 2. PURCHASE ORDERS (upcoming, OPEN)
-- ============================================================

-- PO-2026-041: JM, Apr 14 - replenishes lean 3" and adds 4"x48 buffer
INSERT INTO purchase_orders (po_number, vendor_name, expected_date, status, created_by, created_at)
VALUES ('PO-2026-041', 'JM', '2026-04-14', 'OPEN', 1, '2026-04-08 09:00:00');

INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered, status) VALUES
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-041'), (SELECT id FROM material_skus WHERE sku_code='3036'), 5000, 'OPEN'),
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-041'), (SELECT id FROM material_skus WHERE sku_code='3048'), 6000, 'OPEN'),
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-041'), (SELECT id FROM material_skus WHERE sku_code='4048'), 4500, 'OPEN');

-- PO-2026-042: Certainteed, Apr 17 - targets 4"x72 and 6"x60 (both lean)
INSERT INTO purchase_orders (po_number, vendor_name, expected_date, status, created_by, created_at)
VALUES ('PO-2026-042', 'Certainteed', '2026-04-17', 'OPEN', 1, '2026-04-09 10:00:00');

INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered, status) VALUES
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-042'), (SELECT id FROM material_skus WHERE sku_code='4072'), 3500, 'OPEN'),
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-042'), (SELECT id FROM material_skus WHERE sku_code='6060'), 2400, 'OPEN');

-- PO-2026-043: JM, Apr 22 - replenishes 6" family ahead of week-2 demand
INSERT INTO purchase_orders (po_number, vendor_name, expected_date, status, created_by, created_at)
VALUES ('PO-2026-043', 'JM', '2026-04-22', 'OPEN', 1, '2026-04-10 08:30:00');

INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered, status) VALUES
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-043'), (SELECT id FROM material_skus WHERE sku_code='6036'), 4000, 'OPEN'),
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-043'), (SELECT id FROM material_skus WHERE sku_code='6048'), 5000, 'OPEN'),
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-043'), (SELECT id FROM material_skus WHERE sku_code='6072'), 3000, 'OPEN');
