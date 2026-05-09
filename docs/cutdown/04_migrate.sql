-- ============================================================
-- P&S Inventory System — Cut-Down Feature Migration
-- Run against existing `pands` database
--   mysql -u root -p pands < db/migrate_cutdown.sql
-- ============================================================

USE pands;

-- ------------------------------------------------------------
-- SECTION 0: shipment_lines.rolls — make nullable
-- Required before Section 6 adds CUT_DOWN/WO_LINE paths (no rolls for those paths)
-- ------------------------------------------------------------

ALTER TABLE shipment_lines
  MODIFY COLUMN rolls INT NULL;


-- ------------------------------------------------------------
-- SECTION 1: work_order_lines — branching columns
-- ------------------------------------------------------------

ALTER TABLE work_order_lines
  ADD COLUMN parent_line_id       INT NULL
    COMMENT 'NULL = billing or unbranched. FK to self = production line.',
  ADD COLUMN path_type            ENUM('STANDARD','CUT_LAMINATE','CUT_SHIP','DIRECT_SHIP') NULL
    COMMENT 'Inferred from facing + branch state. Locked at shipment creation.',
  ADD COLUMN reconciliation_status ENUM('CURRENT','STALE','RECONCILED','SUPERSEDED') NOT NULL DEFAULT 'CURRENT'
    COMMENT 'Applies to billing and unbranched lines only. STALE blocks WO completion.',
  ADD CONSTRAINT fk_wol_parent
    FOREIGN KEY (parent_line_id) REFERENCES work_order_lines(id);

-- Index to support "get all production children of a billing line"
CREATE INDEX idx_wol_parent ON work_order_lines(parent_line_id);

-- Index to support stale line queries on WO list view
CREATE INDEX idx_wol_reconciliation ON work_order_lines(wo_id, reconciliation_status);


-- ------------------------------------------------------------
-- SECTION 2: inventory_transactions — add CUT_DOWN reference type
-- ------------------------------------------------------------

-- Extend reference_type to support cut-down as a source
ALTER TABLE inventory_transactions
  MODIFY COLUMN reference_type
    ENUM('PO_LINE','PRODUCTION_RUN','MANUAL','INVENTORY_COUNT','CUT_DOWN')
    DEFAULT 'MANUAL';


-- ------------------------------------------------------------
-- SECTION 3: cut_down_groups
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cut_down_groups (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  wo_id      INT NOT NULL
    COMMENT 'Scoped to a single work order. Enforced by FK.',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wo_id)      REFERENCES work_orders(id),
  FOREIGN KEY (created_by) REFERENCES app_users(id)
);

CREATE INDEX idx_cdg_wo ON cut_down_groups(wo_id);


-- ------------------------------------------------------------
-- SECTION 4: cut_downs
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cut_downs (
  id                INT AUTO_INCREMENT PRIMARY KEY,

  -- Grouping & scheduling
  group_id          INT NULL
    COMMENT 'Optional. Links to cut_down_groups for batch scheduling.',
  wo_id             INT NOT NULL
    COMMENT 'Denormalized from billing_line for direct scoping and query efficiency.',
  billing_line_id   INT NOT NULL
    COMMENT 'The billing work_order_line that drives this cut-down.',

  -- Material
  sku_id            INT NOT NULL
    COMMENT 'Source SKU being cut. May differ from original billing line SKU after reconciliation.',

  -- Scheduling
  run_date          DATE NULL,
  status            ENUM('UNSCHEDULED','SCHEDULED','COMPLETED') NOT NULL DEFAULT 'UNSCHEDULED',

  -- Planned quantities (editable before confirmation)
  rolls_scheduled   INT NOT NULL DEFAULT 0,
  sqft_scheduled    INT NOT NULL DEFAULT 0,

  -- Actual quantities (recorded at confirmation)
  rolls_actual      INT NULL,
  sqft_actual       INT NULL,
  waste_sqft_actual INT NULL
    COMMENT 'Actual waste sqft measured at cut time.',
  source_roll_count INT NULL
    COMMENT 'Number of source rolls physically used.',

  -- Scrap disposition (recorded at confirmation)
  scrap_disposition ENUM('SAVED','DISCARDED','DELIVERED') NULL
    COMMENT 'SAVED = stays in WIP ledger. DISCARDED = written off. DELIVERED = ships with order.',

  -- Notes
  operator_notes    TEXT NULL,

  -- Confirmation
  confirmed_at      TIMESTAMP NULL,
  confirmed_by      INT NULL,

  -- Audit
  created_by        INT NOT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_cd_group        FOREIGN KEY (group_id)        REFERENCES cut_down_groups(id),
  CONSTRAINT fk_cd_wo           FOREIGN KEY (wo_id)           REFERENCES work_orders(id),
  CONSTRAINT fk_cd_billing_line FOREIGN KEY (billing_line_id) REFERENCES work_order_lines(id),
  CONSTRAINT fk_cd_sku          FOREIGN KEY (sku_id)          REFERENCES material_skus(id),
  CONSTRAINT fk_cd_confirmed_by FOREIGN KEY (confirmed_by)    REFERENCES app_users(id),
  CONSTRAINT fk_cd_created_by   FOREIGN KEY (created_by)      REFERENCES app_users(id)
);

CREATE INDEX idx_cd_wo           ON cut_downs(wo_id);
CREATE INDEX idx_cd_billing_line ON cut_downs(billing_line_id);
CREATE INDEX idx_cd_group        ON cut_downs(group_id);
CREATE INDEX idx_cd_status       ON cut_downs(status);


-- ------------------------------------------------------------
-- SECTION 5: wip_ledger
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wip_ledger (
  id               INT AUTO_INCREMENT PRIMARY KEY,

  transaction_type ENUM('CUT_IN','CUT_OUT','SCRAP','ADJUSTMENT') NOT NULL
    COMMENT 'CUT_IN = material created by cut-down. CUT_OUT = consumed by production or shipment. SCRAP = written off. ADJUSTMENT = manual correction.',

  -- Source of the WIP material
  cut_down_id      INT NULL
    COMMENT 'The cut-down that produced this WIP. NULL only for ADJUSTMENT entries.',

  -- Destination of the WIP material (CUT_OUT and SCRAP)
  wo_line_id       INT NULL
    COMMENT 'The production line consuming this WIP. For cross-job scrap reuse, this points to the destination job line.',

  -- Material details
  width_in         INT NOT NULL
    COMMENT 'Actual cut width of this WIP entry.',
  sqft_quantity    INT NOT NULL
    COMMENT 'Positive for CUT_IN, negative for CUT_OUT and SCRAP.',

  -- Dates & audit
  effective_date   DATE NOT NULL DEFAULT (CURDATE()),
  memo             TEXT NULL,
  created_by       INT NOT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_wip_cut_down  FOREIGN KEY (cut_down_id) REFERENCES cut_downs(id),
  CONSTRAINT fk_wip_wo_line   FOREIGN KEY (wo_line_id)  REFERENCES work_order_lines(id),
  CONSTRAINT fk_wip_created_by FOREIGN KEY (created_by) REFERENCES app_users(id)
);

CREATE INDEX idx_wip_cut_down    ON wip_ledger(cut_down_id);
CREATE INDEX idx_wip_wo_line     ON wip_ledger(wo_line_id);
CREATE INDEX idx_wip_effective   ON wip_ledger(effective_date);
CREATE INDEX idx_wip_type        ON wip_ledger(transaction_type);


-- ------------------------------------------------------------
-- SECTION 6: shipment_lines — add cut_down and wo_line sources
-- ------------------------------------------------------------

-- Make existing production_run_id nullable (DIRECT_SHIP and CUT_SHIP have no run)
ALTER TABLE shipment_lines
  MODIFY COLUMN production_run_id INT NULL,
  ADD COLUMN cut_down_id INT NULL
    COMMENT 'Set for CUT_SHIP path.',
  ADD COLUMN wo_line_id  INT NULL
    COMMENT 'Set for DIRECT_SHIP path.',
  ADD CONSTRAINT fk_sl_cut_down
    FOREIGN KEY (cut_down_id) REFERENCES cut_downs(id),
  ADD CONSTRAINT fk_sl_wo_line
    FOREIGN KEY (wo_line_id)  REFERENCES work_order_lines(id);

-- Enforce exactly one source FK is non-null
-- Note: MySQL CHECK constraints are supported from 8.0.16+
-- If running MySQL < 8.0.16, enforce this in application logic instead.
ALTER TABLE shipment_lines
  ADD CONSTRAINT chk_sl_one_source CHECK (
    (production_run_id IS NOT NULL) +
    (cut_down_id       IS NOT NULL) +
    (wo_line_id        IS NOT NULL) = 1
  );

CREATE INDEX idx_sl_cut_down ON shipment_lines(cut_down_id);
CREATE INDEX idx_sl_wo_line  ON shipment_lines(wo_line_id);


-- ------------------------------------------------------------
-- END OF MIGRATION
-- Verify with:
--   SHOW COLUMNS FROM work_order_lines;
--   SHOW COLUMNS FROM shipment_lines;
--   SHOW TABLES LIKE 'cut_down%';
--   SHOW TABLES LIKE 'wip_ledger';
-- ------------------------------------------------------------
