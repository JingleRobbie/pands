-- ============================================================
-- PandS Sample Data — Two-Week Scenario
-- Base date: April 10, 2026
-- Run: mysql -u root -p pands < scripts/seed-sample-data.sql
-- ============================================================

-- ============================================================
-- 1. STARTING INVENTORY (Apr 7 — pre-history baseline)
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
-- 2. HISTORICAL ORDERS (completed before today)
-- ============================================================

-- SO-2026-086: Cornerstone Commercial — Riverside HVAC Phase 1 (shipped Apr 8, COMPLETE)
INSERT INTO sales_orders (so_number, customer_name, job_name, ship_date, status, created_by, created_at)
VALUES ('SO-2026-086', 'Cornerstone Commercial', 'Riverside HVAC Phase 1', '2026-04-08', 'COMPLETE', 1, '2026-04-05 09:00:00');

INSERT INTO sales_order_lines (so_id, sku_id, sqft_ordered, sqft_produced)
VALUES (
  (SELECT id FROM sales_orders WHERE so_number='SO-2026-086'),
  (SELECT id FROM material_skus WHERE sku_code='3048'),
  1200, 1200
);

-- SO-2026-087: Summit Insulation Group — April Spot Order (shipped Apr 9, COMPLETE)
INSERT INTO sales_orders (so_number, customer_name, job_name, ship_date, status, created_by, created_at)
VALUES ('SO-2026-087', 'Summit Insulation Group', 'April Spot Order', '2026-04-09', 'COMPLETE', 1, '2026-04-06 10:00:00');

INSERT INTO sales_order_lines (so_id, sku_id, sqft_ordered, sqft_produced)
VALUES (
  (SELECT id FROM sales_orders WHERE so_number='SO-2026-087'),
  (SELECT id FROM material_skus WHERE sku_code='6048'),
  2400, 2400
);

-- Historical production run: PR-20260407-001 (Cornerstone, 3"x48", confirmed Apr 8)
INSERT INTO production_runs
  (run_number, so_line_id, sku_id, run_date, sqft_scheduled, sqft_actual, status, confirmed_at, confirmed_by, created_by, created_at)
SELECT 'PR-20260407-001', sol.id, ms.id, '2026-04-07', 1200, 1200, 'CONFIRMED', '2026-04-08 14:30:00', 1, 1, '2026-04-07 08:00:00'
FROM sales_order_lines sol
JOIN sales_orders so ON sol.so_id = so.id
JOIN material_skus ms ON sol.sku_id = ms.id
WHERE so.so_number = 'SO-2026-086' AND ms.sku_code = '3048';

INSERT INTO inventory_transactions
  (sku_id, transaction_type, sqft_quantity, reference_type, reference_id, memo, created_by, created_at)
SELECT ms.id, 'CONSUMPTION', 1200, 'PRODUCTION_RUN', pr.id,
       CONCAT('Run ', pr.run_number, ' — SO-2026-086 Riverside HVAC Phase 1'), 1, '2026-04-08 14:30:00'
FROM production_runs pr
JOIN material_skus ms ON pr.sku_id = ms.id
WHERE pr.run_number = 'PR-20260407-001';

-- Historical production run: PR-20260408-001 (Summit, 6"x48", confirmed Apr 9)
INSERT INTO production_runs
  (run_number, so_line_id, sku_id, run_date, sqft_scheduled, sqft_actual, status, confirmed_at, confirmed_by, created_by, created_at)
SELECT 'PR-20260408-001', sol.id, ms.id, '2026-04-08', 2400, 2400, 'CONFIRMED', '2026-04-09 11:15:00', 1, 1, '2026-04-08 08:00:00'
FROM sales_order_lines sol
JOIN sales_orders so ON sol.so_id = so.id
JOIN material_skus ms ON sol.sku_id = ms.id
WHERE so.so_number = 'SO-2026-087' AND ms.sku_code = '6048';

INSERT INTO inventory_transactions
  (sku_id, transaction_type, sqft_quantity, reference_type, reference_id, memo, created_by, created_at)
SELECT ms.id, 'CONSUMPTION', 2400, 'PRODUCTION_RUN', pr.id,
       CONCAT('Run ', pr.run_number, ' — SO-2026-087 April Spot Order'), 1, '2026-04-09 11:15:00'
FROM production_runs pr
JOIN material_skus ms ON pr.sku_id = ms.id
WHERE pr.run_number = 'PR-20260408-001';

-- ============================================================
-- 3. PURCHASE ORDERS (upcoming, OPEN)
-- ============================================================

-- PO-2026-041: JM, Apr 14 — replenishes lean 3" and adds 4"x48 buffer
INSERT INTO purchase_orders (po_number, vendor_name, expected_date, status, created_by, created_at)
VALUES ('PO-2026-041', 'JM', '2026-04-14', 'OPEN', 1, '2026-04-08 09:00:00');

INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered, status) VALUES
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-041'), (SELECT id FROM material_skus WHERE sku_code='3036'), 5000, 'OPEN'),
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-041'), (SELECT id FROM material_skus WHERE sku_code='3048'), 6000, 'OPEN'),
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-041'), (SELECT id FROM material_skus WHERE sku_code='4048'), 4500, 'OPEN');

-- PO-2026-042: Certainteed, Apr 17 — targets 4"x72 and 6"x60 (both lean)
INSERT INTO purchase_orders (po_number, vendor_name, expected_date, status, created_by, created_at)
VALUES ('PO-2026-042', 'Certainteed', '2026-04-17', 'OPEN', 1, '2026-04-09 10:00:00');

INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered, status) VALUES
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-042'), (SELECT id FROM material_skus WHERE sku_code='4072'), 3500, 'OPEN'),
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-042'), (SELECT id FROM material_skus WHERE sku_code='6060'), 2400, 'OPEN');

-- PO-2026-043: JM, Apr 22 — replenishes 6" family ahead of week-2 demand
INSERT INTO purchase_orders (po_number, vendor_name, expected_date, status, created_by, created_at)
VALUES ('PO-2026-043', 'JM', '2026-04-22', 'OPEN', 1, '2026-04-10 08:30:00');

INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered, status) VALUES
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-043'), (SELECT id FROM material_skus WHERE sku_code='6036'), 4000, 'OPEN'),
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-043'), (SELECT id FROM material_skus WHERE sku_code='6048'), 5000, 'OPEN'),
  ((SELECT id FROM purchase_orders WHERE po_number='PO-2026-043'), (SELECT id FROM material_skus WHERE sku_code='6072'), 3000, 'OPEN');

-- ============================================================
-- 4. SALES ORDERS (upcoming)
-- ============================================================

-- SO-2026-088: Ridgeline Contractors — Commerce Park Roof Phase 2 (ship Apr 15)
INSERT INTO sales_orders (so_number, customer_name, job_name, ship_date, status, created_by, created_at)
VALUES ('SO-2026-088', 'Ridgeline Contractors', 'Commerce Park Roof Phase 2', '2026-04-15', 'IN_PROGRESS', 1, '2026-04-09 14:00:00');

INSERT INTO sales_order_lines (so_id, sku_id, sqft_ordered, sqft_produced) VALUES
  ((SELECT id FROM sales_orders WHERE so_number='SO-2026-088'), (SELECT id FROM material_skus WHERE sku_code='3048'), 1800, 0),
  ((SELECT id FROM sales_orders WHERE so_number='SO-2026-088'), (SELECT id FROM material_skus WHERE sku_code='6048'), 2200, 0);

-- SO-2026-089: Apex Building Supply — Lakewood Estates Batch 3 (ship Apr 16)
INSERT INTO sales_orders (so_number, customer_name, job_name, ship_date, status, created_by, created_at)
VALUES ('SO-2026-089', 'Apex Building Supply', 'Lakewood Estates Batch 3', '2026-04-16', 'IN_PROGRESS', 1, '2026-04-09 15:30:00');

INSERT INTO sales_order_lines (so_id, sku_id, sqft_ordered, sqft_produced) VALUES
  ((SELECT id FROM sales_orders WHERE so_number='SO-2026-089'), (SELECT id FROM material_skus WHERE sku_code='3036'), 900, 0),
  ((SELECT id FROM sales_orders WHERE so_number='SO-2026-089'), (SELECT id FROM material_skus WHERE sku_code='4048'), 1400, 0);

-- SO-2026-090: Summit Insulation Group — Regional Distribution Apr (ship Apr 18)
INSERT INTO sales_orders (so_number, customer_name, job_name, ship_date, status, created_by, created_at)
VALUES ('SO-2026-090', 'Summit Insulation Group', 'Regional Distribution Apr', '2026-04-18', 'OPEN', 1, '2026-04-10 09:00:00');

INSERT INTO sales_order_lines (so_id, sku_id, sqft_ordered, sqft_produced) VALUES
  ((SELECT id FROM sales_orders WHERE so_number='SO-2026-090'), (SELECT id FROM material_skus WHERE sku_code='4072'), 1200, 0),
  ((SELECT id FROM sales_orders WHERE so_number='SO-2026-090'), (SELECT id FROM material_skus WHERE sku_code='6060'),  900, 0),
  ((SELECT id FROM sales_orders WHERE so_number='SO-2026-090'), (SELECT id FROM material_skus WHERE sku_code='6072'), 1500, 0);

-- SO-2026-091: Cornerstone Commercial — Riverside HVAC Retrofit (ship Apr 21)
INSERT INTO sales_orders (so_number, customer_name, job_name, ship_date, status, created_by, created_at)
VALUES ('SO-2026-091', 'Cornerstone Commercial', 'Riverside HVAC Retrofit', '2026-04-21', 'OPEN', 1, '2026-04-10 10:00:00');

INSERT INTO sales_order_lines (so_id, sku_id, sqft_ordered, sqft_produced) VALUES
  ((SELECT id FROM sales_orders WHERE so_number='SO-2026-091'), (SELECT id FROM material_skus WHERE sku_code='3072'),  600, 0),
  ((SELECT id FROM sales_orders WHERE so_number='SO-2026-091'), (SELECT id FROM material_skus WHERE sku_code='6048'), 2800, 0);

-- SO-2026-092: Ironwood Construction — Mountain View Custom Homes (ship Apr 23)
INSERT INTO sales_orders (so_number, customer_name, job_name, ship_date, status, created_by, created_at)
VALUES ('SO-2026-092', 'Ironwood Construction', 'Mountain View Custom Homes', '2026-04-23', 'OPEN', 1, '2026-04-10 11:00:00');

INSERT INTO sales_order_lines (so_id, sku_id, sqft_ordered, sqft_produced) VALUES
  ((SELECT id FROM sales_orders WHERE so_number='SO-2026-092'), (SELECT id FROM material_skus WHERE sku_code='4048'), 1600, 0),
  ((SELECT id FROM sales_orders WHERE so_number='SO-2026-092'), (SELECT id FROM material_skus WHERE sku_code='4072'),  800, 0),
  ((SELECT id FROM sales_orders WHERE so_number='SO-2026-092'), (SELECT id FROM material_skus WHERE sku_code='6036'), 1100, 0);

-- SO-2026-093: Ridgeline Contractors — Commerce Park Roof Phase 3 (ship Apr 25)
INSERT INTO sales_orders (so_number, customer_name, job_name, ship_date, status, created_by, created_at)
VALUES ('SO-2026-093', 'Ridgeline Contractors', 'Commerce Park Roof Phase 3', '2026-04-25', 'OPEN', 1, '2026-04-10 11:30:00');

INSERT INTO sales_order_lines (so_id, sku_id, sqft_ordered, sqft_produced) VALUES
  ((SELECT id FROM sales_orders WHERE so_number='SO-2026-093'), (SELECT id FROM material_skus WHERE sku_code='3048'), 2400, 0),
  ((SELECT id FROM sales_orders WHERE so_number='SO-2026-093'), (SELECT id FROM material_skus WHERE sku_code='6072'), 1800, 0);

-- ============================================================
-- 5. PRODUCTION RUNS (SCHEDULED, 1-2 days before ship)
-- ============================================================

-- SO-2026-088 (ship Apr 15) -> run Apr 13
INSERT INTO production_runs (run_number, so_line_id, sku_id, run_date, sqft_scheduled, status, created_by, created_at)
SELECT 'PR-20260413-001', sol.id, ms.id, '2026-04-13', 1800, 'SCHEDULED', 1, '2026-04-10 09:00:00'
FROM sales_order_lines sol JOIN sales_orders so ON sol.so_id=so.id JOIN material_skus ms ON sol.sku_id=ms.id
WHERE so.so_number='SO-2026-088' AND ms.sku_code='3048';

INSERT INTO production_runs (run_number, so_line_id, sku_id, run_date, sqft_scheduled, status, created_by, created_at)
SELECT 'PR-20260413-002', sol.id, ms.id, '2026-04-13', 2200, 'SCHEDULED', 1, '2026-04-10 09:00:00'
FROM sales_order_lines sol JOIN sales_orders so ON sol.so_id=so.id JOIN material_skus ms ON sol.sku_id=ms.id
WHERE so.so_number='SO-2026-088' AND ms.sku_code='6048';

-- SO-2026-089 (ship Apr 16) -> run Apr 15
INSERT INTO production_runs (run_number, so_line_id, sku_id, run_date, sqft_scheduled, status, created_by, created_at)
SELECT 'PR-20260415-001', sol.id, ms.id, '2026-04-15', 900, 'SCHEDULED', 1, '2026-04-10 09:15:00'
FROM sales_order_lines sol JOIN sales_orders so ON sol.so_id=so.id JOIN material_skus ms ON sol.sku_id=ms.id
WHERE so.so_number='SO-2026-089' AND ms.sku_code='3036';

INSERT INTO production_runs (run_number, so_line_id, sku_id, run_date, sqft_scheduled, status, created_by, created_at)
SELECT 'PR-20260415-002', sol.id, ms.id, '2026-04-15', 1400, 'SCHEDULED', 1, '2026-04-10 09:15:00'
FROM sales_order_lines sol JOIN sales_orders so ON sol.so_id=so.id JOIN material_skus ms ON sol.sku_id=ms.id
WHERE so.so_number='SO-2026-089' AND ms.sku_code='4048';

-- SO-2026-090 (ship Apr 18) -> run Apr 17 (same day as PO-042; PO sorts first in matrix)
INSERT INTO production_runs (run_number, so_line_id, sku_id, run_date, sqft_scheduled, status, created_by, created_at)
SELECT 'PR-20260417-001', sol.id, ms.id, '2026-04-17', 1200, 'SCHEDULED', 1, '2026-04-10 09:30:00'
FROM sales_order_lines sol JOIN sales_orders so ON sol.so_id=so.id JOIN material_skus ms ON sol.sku_id=ms.id
WHERE so.so_number='SO-2026-090' AND ms.sku_code='4072';

INSERT INTO production_runs (run_number, so_line_id, sku_id, run_date, sqft_scheduled, status, created_by, created_at)
SELECT 'PR-20260417-002', sol.id, ms.id, '2026-04-17', 900, 'SCHEDULED', 1, '2026-04-10 09:30:00'
FROM sales_order_lines sol JOIN sales_orders so ON sol.so_id=so.id JOIN material_skus ms ON sol.sku_id=ms.id
WHERE so.so_number='SO-2026-090' AND ms.sku_code='6060';

INSERT INTO production_runs (run_number, so_line_id, sku_id, run_date, sqft_scheduled, status, created_by, created_at)
SELECT 'PR-20260417-003', sol.id, ms.id, '2026-04-17', 1500, 'SCHEDULED', 1, '2026-04-10 09:30:00'
FROM sales_order_lines sol JOIN sales_orders so ON sol.so_id=so.id JOIN material_skus ms ON sol.sku_id=ms.id
WHERE so.so_number='SO-2026-090' AND ms.sku_code='6072';

-- SO-2026-091 (ship Apr 21) -> run Apr 20
INSERT INTO production_runs (run_number, so_line_id, sku_id, run_date, sqft_scheduled, status, created_by, created_at)
SELECT 'PR-20260420-001', sol.id, ms.id, '2026-04-20', 600, 'SCHEDULED', 1, '2026-04-10 09:45:00'
FROM sales_order_lines sol JOIN sales_orders so ON sol.so_id=so.id JOIN material_skus ms ON sol.sku_id=ms.id
WHERE so.so_number='SO-2026-091' AND ms.sku_code='3072';

INSERT INTO production_runs (run_number, so_line_id, sku_id, run_date, sqft_scheduled, status, created_by, created_at)
SELECT 'PR-20260420-002', sol.id, ms.id, '2026-04-20', 2800, 'SCHEDULED', 1, '2026-04-10 09:45:00'
FROM sales_order_lines sol JOIN sales_orders so ON sol.so_id=so.id JOIN material_skus ms ON sol.sku_id=ms.id
WHERE so.so_number='SO-2026-091' AND ms.sku_code='6048';

-- SO-2026-092 (ship Apr 23) -> run Apr 22 (same day as PO-043; PO sorts first in matrix)
INSERT INTO production_runs (run_number, so_line_id, sku_id, run_date, sqft_scheduled, status, created_by, created_at)
SELECT 'PR-20260422-001', sol.id, ms.id, '2026-04-22', 1600, 'SCHEDULED', 1, '2026-04-10 10:00:00'
FROM sales_order_lines sol JOIN sales_orders so ON sol.so_id=so.id JOIN material_skus ms ON sol.sku_id=ms.id
WHERE so.so_number='SO-2026-092' AND ms.sku_code='4048';

INSERT INTO production_runs (run_number, so_line_id, sku_id, run_date, sqft_scheduled, status, created_by, created_at)
SELECT 'PR-20260422-002', sol.id, ms.id, '2026-04-22', 800, 'SCHEDULED', 1, '2026-04-10 10:00:00'
FROM sales_order_lines sol JOIN sales_orders so ON sol.so_id=so.id JOIN material_skus ms ON sol.sku_id=ms.id
WHERE so.so_number='SO-2026-092' AND ms.sku_code='4072';

INSERT INTO production_runs (run_number, so_line_id, sku_id, run_date, sqft_scheduled, status, created_by, created_at)
SELECT 'PR-20260422-003', sol.id, ms.id, '2026-04-22', 1100, 'SCHEDULED', 1, '2026-04-10 10:00:00'
FROM sales_order_lines sol JOIN sales_orders so ON sol.so_id=so.id JOIN material_skus ms ON sol.sku_id=ms.id
WHERE so.so_number='SO-2026-092' AND ms.sku_code='6036';

-- SO-2026-093 (ship Apr 25) -> run Apr 24
INSERT INTO production_runs (run_number, so_line_id, sku_id, run_date, sqft_scheduled, status, created_by, created_at)
SELECT 'PR-20260424-001', sol.id, ms.id, '2026-04-24', 2400, 'SCHEDULED', 1, '2026-04-10 10:15:00'
FROM sales_order_lines sol JOIN sales_orders so ON sol.so_id=so.id JOIN material_skus ms ON sol.sku_id=ms.id
WHERE so.so_number='SO-2026-093' AND ms.sku_code='3048';

INSERT INTO production_runs (run_number, so_line_id, sku_id, run_date, sqft_scheduled, status, created_by, created_at)
SELECT 'PR-20260424-002', sol.id, ms.id, '2026-04-24', 1800, 'SCHEDULED', 1, '2026-04-10 10:15:00'
FROM sales_order_lines sol JOIN sales_orders so ON sol.so_id=so.id JOIN material_skus ms ON sol.sku_id=ms.id
WHERE so.so_number='SO-2026-093' AND ms.sku_code='6072';
