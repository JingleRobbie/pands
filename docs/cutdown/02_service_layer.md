# Service Layer Design — Cut-Down Feature
**P&S Inventory System**
*May 2026*

---

## Cross-Cutting Conventions

These apply to every function in this document and mirror the existing codebase exactly.

- **Transactions** — all mutations use `getConnection → beginTransaction → commit/rollback → release`. Read-only functions use `db.query()` directly.
- **Row locking** — any row that will be mutated within a transaction is fetched with `FOR UPDATE`.
- **Dates** — always `localDate()` from `$lib/utils.js`. Never `.toISOString()`.
- **Internal helpers** — `async function`, not exported. Public API is `export async function`.
- **Error handling** — throw `Error` with a human-readable message. Callers (SvelteKit actions) wrap in `fail(400/500, { error })`.
- **Test hooks** — exported as `__xTest` at the bottom of each file.
- **Cross-service calls** — services do not import each other. Shared logic is extracted into internal helpers that accept a `conn` parameter and are called within the same transaction.

---

## File Structure After Refactor

`production.js` is split into two files. `shipping.js` and `inventory.js` are unchanged in structure but `shipping.js` receives targeted modifications.

```
src/lib/services/
  runs.js       ← renamed/refactored from production.js (production run logic only)
  cutdown.js    ← new (cut-down + WIP ledger logic)
  shipping.js   ← modified (multi-path shipment support)
  inventory.js  ← unchanged
```

### What moves out of `production.js` → `runs.js`

All existing exports move unchanged:
- `scheduleRun()`
- `scheduleGroup()`
- `confirmRun()` — **modified** (see Section 3)
- `unproduceRun()` — **modified** (see Section 3)
- `deleteRun()` — unchanged

All internal helpers move unchanged:
- `nextRunNumber()`, `calcSqft()`, `dateOnly()`, `getLockedWoLine()`,
  `getRollsInOpenRuns()`, `getRemainingRolls()`, `validateRollsScheduled()`,
  `findExistingRun()`, `findMatchingOpenRun()`, `addToExistingRun()`,
  `insertProductionRun()`, `prepareScheduleLine()`, `getExistingGroupForDate()`,
  `getOrCreateGroup()`, `validateConfirmableRun()`, `insertShortfallRun()`,
  `prorateUnproduceSqft()`, `validateUnproduceRolls()`

> **Note:** `nextRunNumber()` is currently duplicated in `production.js` and `shipping.js`.
> It should live once in `runs.js` and be copy-pasted (not imported) into `shipping.js`
> until a shared `$lib/db/helpers.js` utility file is warranted. Do not create a cross-service
> import to solve this — it introduces circular dependency risk.

---

## Section 1 — `runs.js` Modified Functions

### `confirmRun(runId, rollsActual, userId, runDate)`

**Purpose:** Confirm a production run as completed. Behavior now differs based on derived line type.

**Steps:**
1. Fetch and lock the production run row (`FOR UPDATE`).
2. Validate the run is confirmable (`validateConfirmableRun`).
3. Fetch the associated `work_order_lines` row joined to `work_orders`.
4. Determine derived line type:
   - If `parent_line_id IS NOT NULL` → **PRODUCTION line** (path 2, CUT_LAMINATE)
   - Otherwise → **BILLING or UNBRANCHED line** (path 1, STANDARD)
5. Calculate `sqftActual = calcSqft(line, rollsActual)`.
6. **If BILLING or UNBRANCHED line:**
   - Insert `CONSUMPTION` into `inventory_transactions` (existing behavior, unchanged).
7. **If PRODUCTION line:**
   - Insert `CUT_OUT` into `wip_ledger` instead of `inventory_transactions`.
   - `cut_down_id` = the confirmed cut-down linked to this production line's billing parent (see helper `getConfirmedCutDownForProductionLine()`).
   - `wo_line_id` = the production line id.
   - `sqft_quantity` = negative `sqftActual` (debit from WIP balance).
   - `width_in` = `line.width_in`.
8. Update `production_runs`: set `rolls_actual`, `sqft_actual`, `run_date`, `status = COMPLETED`, `confirmed_at`, `confirmed_by`.
9. Update `work_order_lines`: increment `rolls_produced` by `rollsActual`.
10. **Auto-close WO check** — only runs on BILLING/UNBRANCHED lines. Production line confirmations do not trigger auto-close. Instead, check all lines (billing + unbranched + production) holistically:
    - A WO is COMPLETE when every billing/unbranched line has `rolls_produced >= qty` AND every production line has `rolls_produced >= qty`.
11. Handle shortfall: if `rollsActual < rolls_scheduled`, call `insertShortfallRun()`.
12. Commit.

---

### `unproduceRun(runId, rollsToUnproduce, userId)`

**Purpose:** Reverse a completed production run. Behavior now differs based on derived line type.

**Steps:**
1. Fetch and lock the production run joined to `work_order_lines` and `work_orders`.
2. Validate run is `COMPLETED`.
3. Lock the associated `work_order_lines` row.
4. Determine derived line type (same as `confirmRun` step 4).
5. Check shipped rolls — cannot unproduce shipped material.
6. **If BILLING or UNBRANCHED line:**
   - Find the original `CONSUMPTION` transaction for this run.
   - Insert `CONSUMPTION_REVERSAL` into `inventory_transactions` (existing behavior, unchanged).
7. **If PRODUCTION line:**
   - Find the original `CUT_OUT` entry in `wip_ledger` for this run.
   - Insert a new `CUT_IN` entry (positive sqft) to restore the WIP balance.
   - `memo` = `"Unproduced run {run_number} — WIP restored"`.
8. Update `production_runs` to reopen (full unproduce) or reduce `rolls_actual` (partial).
9. If partial unproduce, call `insertShortfallRun()`.
10. Decrement `rolls_produced` on `work_order_lines`.
11. Reopen WO if status is `COMPLETE`.
12. Commit.

---

## Section 2 — `cutdown.js` (new file)

All functions in this file follow the same connection/transaction conventions as `runs.js`.

### Internal Helpers

---

#### `nextCutDownNumber(conn)`

**Purpose:** Generate the next sequential internal cut-down identifier.

**Steps:**
1. Query `MAX(cut_down_number)` from `cut_downs`.
2. Parse the sequence suffix and increment by 1.
3. Return formatted string e.g. `CD-000001`.

> Not user-facing. Used only as a unique DB key.

---

#### `getConfirmedCutDownForProductionLine(conn, woLineId)`

**Purpose:** Find the confirmed cut-down linked to a production line via its billing parent. Used by `confirmRun()` and `unproduceRun()` in `runs.js`.

> This helper is exported from `cutdown.js` as a named export so `runs.js` can call it.
> This is the one deliberate cross-file function call in this design — it is a pure read
> with no transaction side effects, so it is safe to call within another file's transaction
> by passing `conn`.

**Steps:**
1. Fetch the `parent_line_id` from `work_order_lines` for the given `woLineId`.
2. Query `cut_downs` where `billing_line_id = parent_line_id` and `status = COMPLETED`.
3. Return the cut-down row, or throw if not found (should not happen if gate logic is correct).

---

#### `validateCutDownConfirmable(cutDown, rollsActual)`

**Purpose:** Guard against invalid confirmation attempts.

**Steps:**
1. Throw if `cutDown` is null (`not found`).
2. Throw if `cutDown.status === COMPLETED` (`already completed`).
3. Throw if `cutDown.run_date` is in the future (`cannot confirm before run date`).
4. Throw if `rollsActual > cutDown.rolls_scheduled` (`exceeds scheduled rolls`).

---

#### `insertWipLedgerEntry(conn, { transactionType, cutDownId, woLineId, widthIn, sqftQuantity, memo, userId })`

**Purpose:** Insert a single WIP ledger row. Used by `confirmCutDown()`, `confirmRun()`, `unproduceRun()`, and `createShipment()`.

**Steps:**
1. Insert into `wip_ledger` with provided values and `effective_date = localDate()`.

---

#### `getCutDownWipBalance(conn, cutDownId)`

**Purpose:** Return the current WIP sqft balance for a given cut-down. Used to validate scrap assignment and shipment creation.

**Steps:**
1. `SELECT SUM(sqft_quantity) FROM wip_ledger WHERE cut_down_id = ?`.
2. Return the sum (positive = material available).

---

### Public API

---

#### `branchLine(woLineId, productionWidths, userId)`

**Purpose:** Branch a work order line into a billing line and one or more production lines. This is the entry point for the cut-down process.

**Parameters:**
- `woLineId` — the existing unbranched line to branch
- `productionWidths` — array of `{ width_in, qty, length_ft }` objects, one per production line
- `userId`

**Steps:**
1. Fetch and lock the `work_order_lines` row.
2. Validate the line has `parent_line_id IS NULL` and no existing children (cannot re-branch).
3. Validate no production runs exist on this line yet (branching after scheduling is not allowed).
4. Validate `productionWidths` is non-empty and each `width_in` is less than or equal to `line.width_in`.
5. The original row becomes the **billing line** — no column changes needed (its `parent_line_id` stays NULL and it now has children, making it a billing line by derivation).
6. Set `reconciliation_status = CURRENT` on the original row (it already defaults to this, but explicit for clarity).
7. For each entry in `productionWidths`:
   - Insert a new `work_order_lines` row with:
     - `wo_id` = same as billing line
     - `parent_line_id` = billing line id
     - `sku_id` = billing line `sku_id`
     - `thickness_in` = billing line `thickness_in`
     - `width_in` = provided `width_in`
     - `qty` = provided `qty` (defaults to billing line `qty` if not specified)
     - `length_ft` = provided `length_ft` (defaults to billing line `length_ft`)
     - `sqft` = recalculated via `calcSqft()`
     - All other fields (`facing`, `rollfor`, `tab_type`, `instructions`) inherited from billing line
     - `rolls_produced = 0`
     - `reconciliation_status = CURRENT`
     - `path_type = NULL` (inferred at shipment creation)
8. Commit.
9. Return array of new production line ids.

---

#### `scheduleCutDown(billingLineId, rollsScheduled, runDate, userId)`

**Purpose:** Create or merge a cut-down order for a billing line, mirroring `scheduleRun()`.

**Steps:**
1. Fetch and lock the billing line.
2. Validate `parent_line_id IS NULL` and line has children (must be a billing line).
3. Validate `rollsScheduled > 0`.
4. Check for an existing non-completed cut-down on this billing line for the same `runDate` — if found, add `rollsScheduled` to it (`UPDATE cut_downs SET rolls_scheduled = rolls_scheduled + ?`).
5. If no existing cut-down, insert a new `cut_downs` row:
   - `cut_down_number` = `nextCutDownNumber(conn)`
   - `wo_id` = billing line's `wo_id`
   - `billing_line_id` = provided
   - `sku_id` = billing line's `sku_id`
   - `run_date` = provided (NULL = UNSCHEDULED)
   - `status` = `SCHEDULED` if `run_date` provided, else `UNSCHEDULED`
   - `rolls_scheduled` = provided
   - `sqft_scheduled` = `calcSqft(billingLine, rollsScheduled)`
6. Commit.
7. Return `cut_down_number`.

---

#### `scheduleCutDownGroup(woId, items, runDate, userId)`

**Purpose:** Batch schedule cut-downs for multiple billing lines on the same work order, mirroring `scheduleGroup()`.

**Parameters:**
- `woId` — work order id (used to create the group)
- `items` — array of `{ billingLineId, rollsScheduled }`
- `runDate`
- `userId`

**Steps:**
1. Validate all `billingLineId` values belong to `woId`.
2. Create a `cut_down_groups` row with `wo_id` and `created_by`.
3. For each item, call the internal steps of `scheduleCutDown()` (passing `conn` and `groupId`) rather than calling the exported function — same pattern as `scheduleGroup()` calling `insertProductionRun()` directly.
4. Commit.
5. Return `groupId`.

---

#### `confirmCutDown(cutDownId, rollsActual, sqftActual, wasteActual, sourceRollCount, scrapDisposition, operatorNotes, userId)`

**Purpose:** Confirm a cut-down as physically completed. Writes inventory CONSUMPTION and WIP CUT_IN entries.

**Steps:**
1. Fetch and lock the `cut_downs` row.
2. Call `validateCutDownConfirmable()`.
3. Fetch the billing line (`FOR UPDATE`).
4. Calculate `sqftActual` if not provided: `calcSqft(billingLine, rollsActual)`.
5. **Write inventory CONSUMPTION:**
   - Insert into `inventory_transactions`:
     - `sku_id` = cut-down's `sku_id`
     - `transaction_type = CONSUMPTION`
     - `sqft_quantity` = `sqftActual`
     - `reference_type = CUT_DOWN`
     - `reference_id` = `cutDownId`
     - `memo` = `"Cut-down {cut_down_number} — {so_number} {job_name}"`
6. **Write WIP CUT_IN entries — one per production line child of the billing line:**
   - Fetch all production line children of `billing_line_id`.
   - For each production line, call `insertWipLedgerEntry()`:
     - `transaction_type = CUT_IN`
     - `cut_down_id` = `cutDownId`
     - `wo_line_id` = production line id
     - `width_in` = production line `width_in`
     - `sqft_quantity` = positive (prorated from `sqftActual` by production line width ratio)
     - `memo` = `"Cut-down {cut_down_number} — {width_in}" cut"`
7. **Handle scrap disposition:**
   - If `scrapDisposition = DISCARDED`: call `insertWipLedgerEntry()` for any remainder sqft with `transaction_type = SCRAP`, negative quantity.
   - If `scrapDisposition = SAVED`: no additional WIP entry — the CUT_IN balance remains available.
   - If `scrapDisposition = DELIVERED`: note is written to the shipment at shipment time — no WIP action here.
8. Update `cut_downs`: set `rolls_actual`, `sqft_actual`, `waste_sqft_actual`, `source_roll_count`, `scrap_disposition`, `operator_notes`, `status = COMPLETED`, `confirmed_at`, `confirmed_by`.
9. Commit.
10. Return `{ cutDownId, sqftActual, scrapDisposition }`.

---

#### `unconfirmCutDown(cutDownId, userId)`

**Purpose:** Reverse a confirmed cut-down. Restores inventory and clears WIP entries. Soft gate — does not block downstream runs or shipments but caller should warn the user if any exist.

**Steps:**
1. Fetch and lock the `cut_downs` row.
2. Validate `status = COMPLETED`.
3. Check for any `COMPLETED` production runs on child production lines — if any exist, collect their run numbers and include in the return value as a warning list (do not block).
4. Check for any shipments using this cut-down via `shipment_lines.cut_down_id` — collect as warning list.
5. **Reverse inventory CONSUMPTION:**
   - Find the `CONSUMPTION` transaction in `inventory_transactions` where `reference_type = CUT_DOWN` and `reference_id = cutDownId`.
   - Insert `CONSUMPTION_REVERSAL` referencing the original transaction via `reverses_transaction_id`.
6. **Clear WIP ledger entries:**
   - Delete all `wip_ledger` rows where `cut_down_id = cutDownId` and `transaction_type IN (CUT_IN, SCRAP)`.
   - Do NOT delete `CUT_OUT` rows — those are owned by production run confirmations and must be reversed separately via `unproduceRun()`.
7. Update `cut_downs`: reopen status (`SCHEDULED` if `run_date` exists, else `UNSCHEDULED`), clear `confirmed_at`, `confirmed_by`, `rolls_actual`, `sqft_actual`, `scrap_disposition`.
8. Commit.
9. Return `{ warnings: { runNumbers, shipmentNumbers } }`.

---

#### `deleteCutDown(cutDownId)`

**Purpose:** Delete an unscheduled or scheduled (unconfirmed) cut-down. Mirrors `deleteRun()`.

**Steps:**
1. Fetch and lock the `cut_downs` row.
2. Throw if not found.
3. Throw if `status = COMPLETED` (`cannot delete a completed cut-down`).
4. Delete the row.
5. Commit.

---

#### `assignScrap(sourceCutDownId, destinationWoLineId, sqftToAssign, userId)`

**Purpose:** Assign saved WIP scrap from one job's cut-down to a production line on another job (or the same job). User-initiated.

**Steps:**
1. Fetch the source cut-down. Validate `status = COMPLETED`.
2. Fetch the destination production line. Validate `parent_line_id IS NOT NULL` (must be a production line).
3. Check width tolerance:
   - `sourceCutDown.width_actual` (derived from WIP ledger `width_in`) must be >= `destinationLine.width_in`.
   - If `sourceCutDown.width_actual < destinationLine.width_in` → throw (`scrap is too narrow`).
   - If `sourceCutDown.width_actual > destinationLine.width_in + 2` → throw (`scrap exceeds 2" width tolerance`).
   - If within tolerance but not exact → proceed (no additional cutting).
4. Check available WIP balance: `getCutDownWipBalance(conn, sourceCutDownId)` must be >= `sqftToAssign`.
5. Call `insertWipLedgerEntry()`:
   - `transaction_type = CUT_OUT`
   - `cut_down_id` = `sourceCutDownId`
   - `wo_line_id` = `destinationWoLineId`
   - `sqft_quantity` = negative `sqftToAssign`
   - `memo` = `"Scrap assigned to WO line {destinationWoLineId}"`
6. Commit.

---

#### `reconcileBillingLine(billingLineId, { newSkuId, newWidthIn, newQty, newLengthFt }, userId)`

**Purpose:** Resolve a STALE billing line after a cut-down modification. Marks it RECONCILED or initiates a split.

**Steps:**
1. Fetch and lock the billing line. Validate `reconciliation_status = STALE`.
2. Apply any provided field updates (`sku_id`, `width_in`, `qty`, `length_ft`).
3. Recalculate `sqft` if `width_in`, `qty`, or `length_ft` changed.
4. Set `reconciliation_status = RECONCILED`.
5. Commit.
6. Return updated billing line.

> **Note:** Billing line split (SUPERSEDED path) is a separate operation — `splitBillingLine()` — described below.

---

#### `splitBillingLine(billingLineId, newLines, userId)`

**Purpose:** Handle complex reconciliation where one billing line must become two or more. The original is marked SUPERSEDED and new billing lines are created. All production children are re-parented.

**Parameters:**
- `billingLineId` — the STALE billing line to supersede
- `newLines` — array of `{ skuId, widthIn, qty, lengthFt }` for each new billing line
- `userId`

**Steps:**
1. Fetch and lock the original billing line. Validate it is STALE.
2. Fetch all production children (`WHERE parent_line_id = billingLineId`).
3. For each entry in `newLines`, insert a new `work_order_lines` row as a billing line:
   - `parent_line_id = NULL`
   - `reconciliation_status = RECONCILED`
   - All other fields as provided or inherited from original.
4. Re-parent production children: for each production child, assign `parent_line_id` to the most appropriate new billing line (matched by closest `width_in` — if ambiguous, assign to the first new billing line and let the user adjust).
5. Mark original billing line `reconciliation_status = SUPERSEDED`.
6. Commit.
7. Return array of new billing line ids.

---

#### `markBillingLineStale(conn, billingLineId)`

**Purpose:** Internal helper. Called by any function that modifies a cut-down after confirmation, to flag the billing line for reconciliation. Not exported — called within `cutdown.js` mutations.

**Steps:**
1. `UPDATE work_order_lines SET reconciliation_status = 'STALE' WHERE id = ? AND reconciliation_status != 'SUPERSEDED'`.

---

## Section 3 — `shipping.js` Modified Functions

### `createShipment(woId, customerId, shipDate, sources, userId, rollsMap)`

**Purpose:** Create a shipment supporting all four fulfillment paths. The `sources` parameter replaces the existing `runIds` parameter to support multiple source types.

**Parameter change:**
```
// Before
createShipment(woId, customerId, shipDate, runIds, userId, rollsMap)

// After
createShipment(woId, customerId, shipDate, sources, userId, rollsMap)

// sources is an array of objects:
// { type: 'PRODUCTION_RUN', id: runId }
// { type: 'CUT_DOWN',       id: cutDownId }
// { type: 'WO_LINE',        id: woLineId }
```

**Steps:**
1. Fetch and validate all sources by type:
   - `PRODUCTION_RUN` — must be `COMPLETED`, must belong to `woId` (existing validation).
   - `CUT_DOWN` — must be `COMPLETED`, must belong to `woId` via `cut_downs.wo_id`.
   - `WO_LINE` — must be unbranched (`parent_line_id IS NULL`, no children), must belong to `woId`.
2. Build shipment number (existing logic unchanged).
3. Insert `shipments` row (existing logic unchanged).
4. For each source, insert a `shipment_lines` row with the appropriate FK populated and the other two NULL.
5. **Path-specific inventory/WIP events:**
   - `PRODUCTION_RUN` sources → existing `splitRunForShipment()` logic, no new transactions.
   - `CUT_DOWN` sources (path 3, CUT_SHIP):
     - Call `insertWipLedgerEntry()` with `transaction_type = CUT_OUT`, negative sqft.
   - `WO_LINE` sources (path 4, DIRECT_SHIP):
     - Insert `CONSUMPTION` into `inventory_transactions`:
       - `reference_type = MANUAL` (no production run or cut-down to reference)
       - `memo` = `"Direct ship — WO line {woLineId} — {so_number}"`
6. **Lock `path_type` on all shipped lines:**
   - For each source, derive and set `path_type` on the corresponding `work_order_lines` row if not already set.
7. Commit.

---

### `updateShipment()` and `confirmShipment()`

No structural changes required. These operate on `shipment_lines` rows that already exist — the source type is already resolved. The existing `rollsMap` / `lineRolls` reduction logic applies to PRODUCTION_RUN lines only. CUT_DOWN and WO_LINE lines do not have rolls in the production sense — sqft is the unit. A note should be added to these functions clarifying that `rolls` on CUT_DOWN and WO_LINE shipment lines is set to 0 or 1 as a placeholder and sqft is the meaningful field.

---

## Section 4 — `inventory.js` Changes

No function signatures change. Two targeted additions:

### `getHistoricalActivityRows()` — add CUT_DOWN transaction type

The existing function queries `PRODUCTION_RUN` consumption transactions for the history view. It must also query `CUT_DOWN` consumption transactions and render them as a new `subType: 'cutdown'` historical row, showing the source SKU consumed and the work order it was cut for.

### `getScheduledProductionRuns()` (internal) — filter to billing/unbranched lines only

This function feeds the inventory matrix. It should exclude production lines (`parent_line_id IS NOT NULL`) since production line confirmations no longer consume inventory. Add `AND wol.parent_line_id IS NULL` to the WHERE clause.

---

## Section 5 — Shared Internal Helper (copy, not import)

`nextRunNumber()` currently exists in both `production.js` (moving to `runs.js`) and `shipping.js`. Until a `$lib/db/helpers.js` utility module is warranted, keep both copies. They are identical and low-risk. Add a comment to each:

```js
// NOTE: Duplicate of nextRunNumber() in runs.js.
// Do not import across service files — copy intentional until a shared helper module exists.
```

`nextCutDownNumber()` in `cutdown.js` follows the same pattern but uses a different prefix and table.

---

## Section 6 — Stale Flag Trigger Points

Any function that modifies a `cut_downs` row after it has been `COMPLETED` must call `markBillingLineStale()` before committing. The trigger points are:

| Function | Trigger condition |
|---|---|
| `unconfirmCutDown()` | Always — reverting a confirmed cut-down always stales the billing line |
| Future: edit cut-down SKU/width | On any field change that affects inventory or WIP |

---

## Section 7 — WO Completion Gate

The existing `confirmRun()` auto-close check (`rolls_produced >= qty` for all lines) must be updated. New logic:

A work order moves to `COMPLETE` when ALL of the following are true:
- Every billing line: `rolls_produced >= qty`
- Every unbranched line: `rolls_produced >= qty`
- Every production line: `rolls_produced >= qty`
- No billing or unbranched line has `reconciliation_status = STALE`

The last condition is a hard block. The query becomes:

```sql
SELECT COUNT(*) AS incomplete
FROM work_order_lines
WHERE wo_id = ?
  AND (
    rolls_produced < qty
    OR (parent_line_id IS NULL AND reconciliation_status = 'STALE')
  )
```

If `incomplete = 0`, set WO to `COMPLETE`.
