# Cut-Down Feature — Claude Code Handoff Notes
**P&S Inventory System**
*May 2026*

---

## Purpose

This document covers unresolved decisions, implementation gotchas, and the recommended
build sequence for the Cut-Down feature. Read this alongside the other four documents
in this folder before touching any code.

---

## 1. Resolved Decision: `shipment_lines.rolls`

The existing `shipment_lines.rolls` column is `NOT NULL`. After the migration, shipment
lines created via the CUT_DOWN path (path 3) and WO_LINE path (path 4) have no meaningful
rolls value.

**Decision: make `rolls` nullable.**

Add this to the migration script before running it:

```sql
ALTER TABLE shipment_lines
  MODIFY COLUMN rolls INT NULL;
```

Convention: `rolls` is `NULL` for CUT_DOWN and WO_LINE path shipment lines. `sqft` is
the meaningful field for those paths. Existing PRODUCTION_RUN path lines are unaffected —
`rolls` remains populated as today.

---

## 2. The One Cross-File Import

`runs.js` needs to know whether a confirmed cut-down exists for a production line before
writing WIP ledger entries in `confirmRun()` and `unproduceRun()`. This lookup lives in
`cutdown.js` as `getConfirmedCutDownForProductionLine()`.

This is the **only** place one service file references another in this codebase. It is
a deliberate, documented exception — not a pattern to follow elsewhere.

**Implementation rules:**
- Export it as a named export from `cutdown.js`:
  ```js
  export async function getConfirmedCutDownForProductionLine(conn, woLineId) { ... }
  ```
- Import it in `runs.js`:
  ```js
  import { getConfirmedCutDownForProductionLine } from '$lib/services/cutdown.js';
  ```
- It is a **pure read** — no writes, no side effects. Safe to call within another
  file's open transaction by passing `conn`.
- Never expand this pattern. If more cross-service reads are needed in the future,
  create a `$lib/services/shared.js` utility module instead.

---

## 3. `nextRunNumber()` Duplication

`nextRunNumber()` currently exists in both `production.js` (moving to `runs.js`) and
`shipping.js`. They are identical. **Do not create a cross-service import to consolidate
them.** Keep both copies and add this comment to each:

```js
// NOTE: Duplicate of nextRunNumber() in [runs.js | shipping.js].
// Copy is intentional — do not import across service files.
// Consolidate into $lib/services/shared.js if a third copy is ever needed.
```

`nextCutDownNumber()` in `cutdown.js` follows the same pattern but uses the
`cut_downs` table and `CD-` prefix.

---

## 4. `production.js` → `runs.js` Rename

`production.js` is renamed to `runs.js` as part of this work. After renaming:

- Search the entire codebase for `from '$lib/services/production.js'` (or wherever
  the services live) and update every import to `runs.js`
- Search for any SvelteKit route `+page.server.js` files that import from `production.js`
- The export signatures do not change — only the file name changes
- Do the rename and import updates **before** making any logic changes to the file,
  so the diff is clean and reviewable

---

## 5. MySQL Version

**8.0.45** — CHECK constraints are fully enforced. The `chk_sl_one_source` constraint
on `shipment_lines` (exactly one of `production_run_id`, `cut_down_id`, `wo_line_id`
must be non-null) will be enforced at the database level. No need for application-only
fallback logic.

---

## 6. Recommended Implementation Order

Work in this sequence. Each step produces something testable before the next begins.

### Step 1 — Database
- Add the `rolls` nullable change (Section 1 above) to `migrate_cutdown.sql`
- Run the migration against the dev database
- Verify with the `SHOW COLUMNS` and `SHOW TABLES` checks at the bottom of the migration script

### Step 2 — Rename and audit
- Rename `production.js` → `runs.js`
- Update all imports across the codebase
- Confirm the existing site still runs with no regressions

### Step 3 — `branchLine()` in `cutdown.js`
- Create `cutdown.js` with just this one function plus `nextCutDownNumber()`
- Build `/wo/[id]/branch` route (page + actions)
- Test: branch a line, verify billing/production line structure in DB,
  verify tabbed view on `/wo/[id]` shows lines correctly

### Step 4 — `confirmRun()` / `unproduceRun()` modifications in `runs.js`
- Add `getConfirmedCutDownForProductionLine()` to `cutdown.js` first (needed by runs.js)
- Modify `confirmRun()` to route to WIP ledger vs inventory based on line type
- Modify `unproduceRun()` to reverse WIP ledger entries for production lines
- Update WO auto-close check to include reconciliation_status guard
- Test: confirm a production line run, verify WIP CUT_OUT written, verify no inventory transaction

### Step 5 — Cut-down scheduling and confirmation in `cutdown.js`
- `scheduleCutDown()`, `scheduleCutDownGroup()`, `confirmCutDown()`, `unconfirmCutDown()`, `deleteCutDown()`
- Build `/wo/[id]/cutdown` route
- Build `/wo/[id]/cutdown/[cutDownId]/confirm` route
- Test: full cut-down lifecycle — schedule, confirm, verify CONSUMPTION + WIP CUT_IN entries

### Step 6 — `shipping.js` modifications
- Add nullable `rolls` support
- Extend `createShipment()` for multi-path sources
- Build or update shipment creation UI to support CUT_DOWN and WO_LINE sources
- Test: each of the four fulfillment paths end-to-end

### Step 7 — Reconciliation
- `reconcileBillingLine()` and `splitBillingLine()` in `cutdown.js`
- Build `/wo/[id]/diff` route
- Test: modify a cut-down after confirmation, verify billing line goes STALE,
  reconcile it, verify WO can complete

### Step 8 — WIP scrap
- `assignScrap()` in `cutdown.js`
- Build `/wip` route
- Test: save scrap from one job, assign to a production line on another job,
  verify WIP ledger entries and width tolerance enforcement

### Step 9 — `inventory.js` additions
- Add CUT_DOWN transaction type to `getHistoricalActivityRows()`
- Filter `getScheduledProductionRuns()` to billing/unbranched lines only
- Test: verify inventory matrix still balances, cut-down consumptions appear in history

### Step 10 — Stale indicators and WO list
- Add `hasStale` and `hasBranched` to `/wo` list query
- Add stale badge and branch icon to WO list UI
- Add `completeWo` action to `/wo/[id]`
- Test: stale WO cannot be completed, badge appears on list, clears after reconciliation

---

## 7. Key Invariants to Test After Each Step

These should never be violated. Add assertions or DB checks after each step:

- A `work_order_lines` row with `parent_line_id IS NOT NULL` must never have an
  `inventory_transactions` row with `reference_type = PRODUCTION_RUN` pointing to
  any of its production runs
- A `work_order_lines` row with `parent_line_id IS NULL` that has children must never
  have a `production_runs` row directly on it (production runs only go on children
  or unbranched lines)
- `wip_ledger` balance for any `cut_down_id` must never go negative
- `shipment_lines` must always have exactly one of `production_run_id`, `cut_down_id`,
  `wo_line_id` non-null (enforced by DB constraint, but verify in integration tests)
- A work order with any `reconciliation_status = STALE` line must never have
  `status = COMPLETE`

---

## 8. Files in This Folder

| File | Purpose |
|---|---|
| `01_feature_spec.md` | Full feature specification including schema changes |
| `02_service_layer.md` | Service layer design — all functions with step-by-step logic |
| `03_ui_routing.md` | All routes — load data, actions, UI notes |
| `04_migration.sql` | Database migration script — run before any code changes |
| `05_handoff_notes.md` | This file — decisions, gotchas, build sequence |
