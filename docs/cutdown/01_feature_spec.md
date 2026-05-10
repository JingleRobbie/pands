# Cut-Down Feature Specification

**P&S Inventory System — Work Order Line Branching**
_Generated from design session — May 2026_

---

## 1. Overview

This document describes the design for **Cut-Down** — a new production process that physically branches work order lines into a billing branch and one or more production branches. It covers the full lifecycle from line branching through cut-down scheduling, WIP tracking, fulfillment, and QuickBooks reconciliation.

---

## 2. Core Concept: Line Branching

### 2.1 What Branching Is

A `work_order_line` row may be **branched** into:

- One **billing line** — the original row, representing what was ordered and what drives the QuickBooks invoice. Tracks inventory consumption. Sqft is based on the original (pre-cut) width.
- One or more **production lines** — new rows representing cut widths to be produced/laminated. Do not affect inventory directly.

An **unbranched line** is any line that has never been branched. It behaves exactly as lines do today.

### 2.2 Line Type — Derived, Not Stored

Line type is derived from the `parent_line_id` relationship:

| Condition                                      | Derived Type |
| ---------------------------------------------- | ------------ |
| `parent_line_id IS NULL` AND no children exist | `UNBRANCHED` |
| `parent_line_id IS NULL` AND children exist    | `BILLING`    |
| `parent_line_id IS NOT NULL`                   | `PRODUCTION` |

No `line_type` column is stored. All queries derive type from the relationship.

**User-facing terminology:** Both `UNBRANCHED` and `BILLING` internal types are displayed to users as "Billing." The distinction is internal only — both drive QB invoicing identically. `PRODUCTION` lines are shown under a separate "Production" tab.

### 2.3 Schema Change: `work_order_lines`

```sql
ALTER TABLE work_order_lines
  ADD COLUMN parent_line_id INT NULL,
  ADD COLUMN path_type ENUM('STANDARD','CUT_LAMINATE','CUT_SHIP','DIRECT_SHIP') NULL,
  ADD COLUMN reconciliation_status ENUM('CURRENT','STALE','RECONCILED','SUPERSEDED') NOT NULL DEFAULT 'CURRENT',
  ADD CONSTRAINT fk_wol_parent FOREIGN KEY (parent_line_id)
    REFERENCES work_order_lines(id);
```

`path_type` is inferred and locked at shipment creation. `reconciliation_status` applies only to billing and unbranched lines.

### 2.4 Fields Inherited by Production Lines at Branch Time

| Field          | Inherited    | Editable After Branch     |
| -------------- | ------------ | ------------------------- |
| `sku_id`       | Yes          | No (follows cut-down SKU) |
| `thickness_in` | Yes          | No                        |
| `width_in`     | Cut width    | Yes                       |
| `qty`          | Yes          | Yes                       |
| `length_ft`    | Yes          | Yes                       |
| `sqft`         | Recalculated | Derived                   |
| `facing`       | Yes          | No                        |
| `rollfor`      | Yes          | No                        |
| `tab_type`     | Yes          | No                        |
| `instructions` | Yes          | No                        |

---

## 3. Four Fulfillment Paths

Each line follows exactly one fulfillment path. Path is inferred from facing and branch state, then locked at shipment creation.

### 3.1 Path Inference Rules

| Line State       | Facing         | Inferred Path  |
| ---------------- | -------------- | -------------- |
| Unbranched       | Raw or Unfaced | `DIRECT_SHIP`  |
| Unbranched       | Any other      | `STANDARD`     |
| Production child | Raw or Unfaced | `CUT_SHIP`     |
| Production child | Any other      | `CUT_LAMINATE` |

Branching is forced by a cut-down order. Unbranched lines cannot have cut-down orders.

### 3.2 Path Flows and Inventory Events

**Path 1 — STANDARD**

```
production run → confirm → ship
```

Inventory `CONSUMPTION` written at production run confirmation (current behavior).

**Path 2 — CUT_LAMINATE**

```
cut-down order → confirm → production run → confirm → ship
```

- Cut-down confirmation writes inventory `CONSUMPTION` for source SKU
- Production run confirmation writes `CUT_OUT` to WIP ledger
- No inventory transaction at production run confirmation

**Path 3 — CUT_SHIP**

```
cut-down order → confirm → ship
```

- Cut-down confirmation writes inventory `CONSUMPTION` for source SKU
- `CUT_OUT` written to WIP ledger at shipment

**Path 4 — DIRECT_SHIP**

```
ship straight from inventory
```

Inventory `CONSUMPTION` written at shipment confirmation.

---

## 4. Cut-Down Process

Cut-Down is the physical shop floor operation of cutting source material rolls to narrower widths. It is a tracked production process with its own scheduling and confirmation lifecycle.

### 4.1 New Tables

#### `cut_down_groups`

```sql
CREATE TABLE cut_down_groups (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  wo_id      INT NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wo_id)      REFERENCES work_orders(id),
  FOREIGN KEY (created_by) REFERENCES app_users(id)
);
```

Groups are scoped to a single work order, enforced by the `wo_id` FK. To batch cut-downs across multiple work orders, create a separate group per work order.

#### `cut_downs`

```sql
CREATE TABLE cut_downs (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  cut_down_number     VARCHAR(30) UNIQUE NOT NULL,
  group_id            INT NULL,
  billing_line_id     INT NOT NULL,
  sku_id              INT NOT NULL,
  run_date            DATE NULL,
  status              ENUM('UNSCHEDULED','SCHEDULED','COMPLETED') DEFAULT 'UNSCHEDULED',
  rolls_scheduled     INT NOT NULL DEFAULT 0,
  rolls_actual        INT NULL,
  sqft_scheduled      INT NOT NULL,
  sqft_actual         INT NULL,
  waste_sqft_actual   INT NULL,
  source_roll_count   INT NULL,
  operator_notes      TEXT NULL,
  scrap_disposition   ENUM('SAVED','DISCARDED','DELIVERED') NULL,
  confirmed_at        TIMESTAMP NULL,
  confirmed_by        INT NULL,
  created_by          INT NOT NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES cut_down_groups(id),
  FOREIGN KEY (billing_line_id) REFERENCES work_order_lines(id),
  FOREIGN KEY (sku_id) REFERENCES material_skus(id),
  FOREIGN KEY (confirmed_by) REFERENCES app_users(id),
  FOREIGN KEY (created_by) REFERENCES app_users(id)
);
```

`cut_down_number` is system-generated for internal database uniqueness only. It is not displayed to or referenced by users or shop floor personnel. Format is a simple auto-incremented internal key (e.g. `CD-000001`).

Quantities are editable prior to confirmation, mirroring production run behavior.

### 4.2 Lifecycle

```
UNSCHEDULED → SCHEDULED → COMPLETED
```

Mirrors `production_runs` lifecycle exactly. Admin role required for confirmation. Admin override available.

### 4.3 Inventory Consumption

- Cut-down confirmation writes one `CONSUMPTION` transaction against the source SKU.
- A cut-down may only consume inventory **once**. Reversal requires an `unproduceCutDown()` operation.
- Production line confirmation (paths 2 and 3) does **not** write inventory transactions.

---

## 5. WIP Ledger

Cut material between cut-down completion and lamination/shipment is tracked as Work-In-Progress (WIP), scoped to a job but potentially reusable as scrap.

### 5.1 New Table: `wip_ledger`

```sql
CREATE TABLE wip_ledger (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  transaction_type ENUM('CUT_IN','CUT_OUT','SCRAP','ADJUSTMENT') NOT NULL,
  cut_down_id      INT NULL,
  wo_line_id       INT NULL,
  width_in         INT NOT NULL,
  sqft_quantity    INT NOT NULL,
  memo             TEXT NULL,
  effective_date   DATE NOT NULL DEFAULT (CURDATE()),
  created_by       INT NOT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cut_down_id) REFERENCES cut_downs(id),
  FOREIGN KEY (wo_line_id) REFERENCES work_order_lines(id),
  FOREIGN KEY (created_by) REFERENCES app_users(id)
);
```

### 5.2 Transaction Types

| Type         | When Written                                                   | Notes                                 |
| ------------ | -------------------------------------------------------------- | ------------------------------------- |
| `CUT_IN`     | Cut-down confirmed                                             | One entry per production line yielded |
| `CUT_OUT`    | Production run confirmed (path 2) or shipment created (path 3) | Consumes WIP                          |
| `SCRAP`      | Scrap disposition set to `DISCARDED` at cut-down confirmation  | Writes off leftover                   |
| `ADJUSTMENT` | Manual admin action                                            | For discrepancies                     |

### 5.3 Scrap Disposition

Recorded at cut-down confirmation. Three outcomes:

| Disposition | WIP Ledger Effect                                      |
| ----------- | ------------------------------------------------------ |
| `SAVED`     | `CUT_IN` entry remains as available balance            |
| `DISCARDED` | `SCRAP` transaction written off immediately            |
| `DELIVERED` | Goes with the order it was cut from; noted on shipment |

### 5.4 Scrap Reuse Across Jobs

Scrap reuse is user-initiated. A user searches available WIP balance and assigns saved scrap to a production line on another job.

**Width tolerance rule:** Scrap width may be 1–2 inches wider than the production line's required width. Narrower scrap is blocked by the system. The system warns but does not block on width mismatch within tolerance — no additional cutting is performed.

When scrap from Job A is used on Job B:

- The WIP ledger `CUT_OUT` entry on Job B references both the source `cut_down_id` (Job A) and the destination `wo_line_id` (Job B production line)
- No new inventory transaction is written — consumption already occurred at Job A's cut-down confirmation
- The billing line on Job B may reflect zero SKU consumption for that production line, which is a valid reconciliation outcome

> **Future:** Scrap WIP may become a finished good. The WIP ledger transaction-type approach supports this expansion.

---

## 6. Shipment Changes

### 6.1 `shipment_lines` Schema Change

```sql
ALTER TABLE shipment_lines
  ADD COLUMN cut_down_id INT NULL,
  ADD COLUMN wo_line_id  INT NULL,
  MODIFY COLUMN production_run_id INT NULL,
  ADD CONSTRAINT fk_sl_cut_down FOREIGN KEY (cut_down_id)
    REFERENCES cut_downs(id),
  ADD CONSTRAINT fk_sl_wo_line FOREIGN KEY (wo_line_id)
    REFERENCES work_order_lines(id),
  ADD CONSTRAINT chk_sl_source CHECK (
    (production_run_id IS NOT NULL)::int +
    (cut_down_id IS NOT NULL)::int +
    (wo_line_id IS NOT NULL)::int = 1
  );
```

Exactly one of the three source FKs must be non-null, enforced by check constraint.

### 6.2 Source FK by Path

| Path         | `production_run_id` | `cut_down_id` | `wo_line_id` |
| ------------ | ------------------- | ------------- | ------------ |
| STANDARD     | ✓                   | —             | —            |
| CUT_LAMINATE | ✓                   | —             | —            |
| CUT_SHIP     | —                   | ✓             | —            |
| DIRECT_SHIP  | —                   | —             | ✓            |

### 6.3 Path Locking

`path_type` on `work_order_lines` is locked when a shipment is created. It is only released if the shipment is cancelled.

### 6.4 Delivered Scrap

When scrap disposition is `DELIVERED`, it goes with the order it was cut from. Recorded as a note on the shipment only — no separate `shipment_lines` row. Customer takes all of it or none.

---

## 7. Billing Reconciliation

### 7.1 Reconciliation Status

`reconciliation_status` on `work_order_lines` (billing and unbranched lines only):

| Status       | Meaning                                                                     |
| ------------ | --------------------------------------------------------------------------- |
| `CURRENT`    | Billing line matches cut-down reality                                       |
| `STALE`      | Cut-down was modified; billing line needs review                            |
| `RECONCILED` | User has reviewed and accepted the billing line                             |
| `SUPERSEDED` | Billing line was split during complex reconciliation; replaced by new lines |

### 7.2 When Staleness Is Triggered

A billing line is marked `STALE` when its associated cut-down order is modified in a way that changes the source SKU, width, or quantity. This is detected by the system automatically — the user does not need to manually flag it.

### 7.3 The Gate — Soft Warning

The cut-down confirmation gate for downstream processes (production runs, shipments) is **soft**:

- The system **warns** when a production run or shipment is being confirmed but the billing line is `STALE`
- The system does **not block** the operation
- Admin override is not required — the warning is informational
- Reconciliation is a separate, required step before work order completion

### 7.4 Reconciliation Required for COMPLETE

A work order cannot be marked `COMPLETE` if any billing or unbranched line has `reconciliation_status = 'STALE'`. This is a hard block. The system displays exactly which lines need reconciliation with direct links to the diff/reconciliation view.

### 7.5 Complex Reconciliation (Billing Line Split)

In unusual cases a billing line may need to be split to reflect two different source SKUs consumed. The process:

1. Original billing line is marked `SUPERSEDED`
2. Two (or more) new billing lines are created as the source of truth
3. All production children are re-parented to the most appropriate new billing line — no orphaned production lines
4. The superseded line retains its history but has no active children

### 7.6 QuickBooks Integration

Reconciliation is the source of truth for QuickBooks invoicing. Export is manual. The reconciliation audit trail (status history, superseded lines, WIP ledger) must be clean enough to support future API integration.

---

## 8. UI Requirements

### 8.1 Work Order Detail View — Line Tabs

The work order detail page (`/wo/[id]`) presents lines in a tabbed filter:

- **Billing** tab — shows billing lines and unbranched lines
- **Production** tab — shows production lines grouped under their billing parent

### 8.2 Diff View

Route: `/wo/[id]/diff`

- Side-by-side view of billing lines and their production children showing **current state only**
- Accessible even when no lines have been branched (shows all lines as unbranched/identical)
- This is also the primary reconciliation UI for resolving stale billing lines

### 8.3 Stale Line Indicators

- `STALE` billing lines are visually flagged in the work order detail view
- Work order list view (`/wo`) shows a stale indicator on any work order with unreconciled lines
- The COMPLETE action is disabled with a message listing offending lines and links to the diff view

### 8.4 Scrap Assignment UI

User-initiated. A search interface allows browsing available WIP balance (saved scrap) and assigning it to a production line. System warns if scrap width is within tolerance but not exact. System blocks if scrap is narrower than required.

---

## 9. Service Layer Changes

### 9.1 New Services / Functions

| Function                 | Description                                                            |
| ------------------------ | ---------------------------------------------------------------------- |
| `branchLine()`           | Creates billing line (mutates original) + one or more production lines |
| `scheduleCutDown()`      | Create or merge cut-down for a billing line                            |
| `scheduleCutDownGroup()` | Batch schedule; creates `cut_down_groups`                              |
| `confirmCutDown()`       | CONSUMPTION txn + WIP `CUT_IN` entries + scrap disposition             |
| `unconfirmCutDown()`     | Reverse CONSUMPTION, reopen WIP, invalidate downstream (soft)          |
| `deleteCutDown()`        | Remove unscheduled/unconfirmed cut-downs                               |
| `assignScrap()`          | Link saved WIP from another job to a production line                   |
| `reconcileBillingLine()` | Mark STALE line as RECONCILED or trigger split                         |

### 9.2 Modified Services

| Function           | Change                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `confirmRun()`     | Skip CONSUMPTION for production lines (path 2); write WIP `CUT_OUT` instead                                  |
| `unproduceRun()`   | Reverse WIP `CUT_OUT` for production lines; reverse CONSUMPTION for billing/unbranched                       |
| `createShipment()` | Write CONSUMPTION for DIRECT_SHIP path; write WIP `CUT_OUT` for CUT_SHIP path; lock `path_type` on all lines |

---

## 10. Backburner Items

These items were identified during design but deferred:

1. **`confirmRun()` / `unproduceRun()` full refactor** — the complete rewrite needed to route inventory vs WIP transactions based on derived line type
2. **Scrap becoming a finished good** — WIP ledger supports this but no process defined yet
3. **Full auth/permission/role system** — all new processes use admin role for now; a permission layer will be designed separately
4. **Physical WIP location tracking** — scrap is stored in a common place; no bin/shelf tracking needed currently

---

## 11. Resolved Design Decisions

Previously open questions, now resolved:

| Question               | Decision                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| Cut-down group scope   | Groups are scoped to a single work order. Create separate groups for separate work orders.  |
| Cut-down number format | System-generated internal key only (`CD-000001`). Not user-facing or shop floor referenced. |
| Diff view depth        | Current state only. No reconciliation history view.                                         |
