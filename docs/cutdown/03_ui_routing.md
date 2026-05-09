# UI Routing Plan — Cut-Down Feature
**P&S Inventory System**
*May 2026*

---

## Conventions

- All routes live under `src/routes/`
- Every route has a `+page.svelte` (UI) and `+page.server.js` (load + actions)
- `load()` runs server-side; data is passed to the page as `data` prop
- Form actions use SvelteKit `?/actionName` pattern
- Auth: `requireAdmin()` called at the top of any action that mutates
- Errors: load functions throw naturally; actions return `fail(400/500, { error })`
- Dates: `localDate()` everywhere — never `.toISOString()`
- New routes are marked **[NEW]**; modified routes are marked **[MODIFIED]**

---

## Route Index

| Route | Status | Description |
|---|---|---|
| `/wo` | MODIFIED | WO list — add stale indicator |
| `/wo/[id]` | MODIFIED | WO detail — tabbed billing/production view |
| `/wo/[id]/diff` | NEW | Diff/reconciliation view |
| `/wo/[id]/schedule` | MODIFIED | Schedule production runs — filter to production/unbranched lines |
| `/wo/[id]/confirm` | MODIFIED | Confirm production runs — path-aware |
| `/wo/[id]/address` | UNCHANGED | Edit shipping address |
| `/wo/[id]/branch` | NEW | Branch a line into billing + production lines |
| `/wo/[id]/cutdown` | NEW | Schedule and manage cut-down orders |
| `/wo/[id]/cutdown/[cutDownId]/confirm` | NEW | Confirm a cut-down |
| `/wo/import` | UNCHANGED | Import WOs from file |
| `/wip` | NEW | WIP ledger overview — available scrap across all jobs |

---

## Route Details

---

### `/wo` — WO List [MODIFIED]

#### `load()`
Fetches:
- All work orders filtered by `status` and date range (existing)
- For each WO, a `hasStale` boolean: `EXISTS (SELECT 1 FROM work_order_lines WHERE wo_id = wo.id AND reconciliation_status = 'STALE')`
- For each WO, a `hasBranched` boolean: `EXISTS (SELECT 1 FROM work_order_lines WHERE wo_id = wo.id AND parent_line_id IS NOT NULL)`

Returns: `{ workOrders: [...] }` where each row includes `hasStale` and `hasBranched`.

#### Actions
None. List is read-only.

#### UI Notes
- Add a amber/yellow stale indicator badge on any WO row where `hasStale = true`
- Add a small branch icon on any WO row where `hasBranched = true`
- Stale badge links directly to `/wo/[id]/diff`

---

### `/wo/[id]` — WO Detail [MODIFIED]

#### `load({ params })`
Fetches:
- Work order header (existing)
- Contacts (existing)
- Accessories (existing)
- **All `work_order_lines` for this WO** — now includes `parent_line_id`, `path_type`, `reconciliation_status`
- For each line, derived `line_type` computed in load: `UNBRANCHED | BILLING | PRODUCTION`
- For each billing line, its production children (grouped by `parent_line_id`)
- For each line, any associated cut-down orders (joined via `billing_line_id` or via parent)
- Shipments summary (existing)
- `canComplete` boolean: no lines with `reconciliation_status = STALE` and all `rolls_produced >= qty`

Returns: `{ wo, contacts, accessories, billingLines, productionLines, unbrandedLines, shipments, canComplete }`

#### Actions

**`linkCustomer`** — existing, unchanged

**`addContact`** — existing, unchanged

**`deleteContact`** — existing, unchanged

**`completeWo`** — NEW
- `requireAdmin()`
- Validates `canComplete` server-side (re-checks stale and rolls_produced)
- Sets `work_orders.status = COMPLETE`
- Returns error listing stale lines if validation fails

**`cancelWo`** — existing pattern, unchanged

#### UI Notes
- **Tabs**: `Billing / Unbranched` tab and `Production` tab
- **Billing tab**: shows billing lines and unbranched lines
  - Each billing line shows: `reconciliation_status` badge, link to diff view, link to `/wo/[id]/branch` if unbranched, cut-down status summary
  - STALE lines show an amber banner with a direct link to `/wo/[id]/diff`
- **Production tab**: production lines grouped under their billing parent's `so_number` + line summary
  - Each production line shows: `path_type` badge, `rolls_produced / qty`, cut-down gate status
- **Complete WO button**: disabled with tooltip if `canComplete = false`, listing the reason (stale lines or incomplete rolls)
- **Branch button**: appears on unbranched lines only; links to `/wo/[id]/branch?lineId=[id]`
- **Diff button**: always visible; links to `/wo/[id]/diff`

---

### `/wo/[id]/diff` — Diff / Reconciliation View [NEW]

#### `load({ params })`
Fetches:
- Work order header (id, so_number, job_name, status)
- All billing lines for this WO with full field set
- For each billing line, all production children with full field set
- All unbranched lines with full field set
- For each billing line, the most recent associated cut-down (`billing_line_id`, status, sku_id, confirmed_at)
- `reconciliation_status` for each billing/unbranched line

Returns: `{ wo, diffRows }` where each `diffRow` is:
```js
{
  billingLine: { ...fields, reconciliation_status },
  productionLines: [ { ...fields }, ... ],  // empty array if unbranched
  cutDown: { id, status, sku_id, confirmed_at } | null,
  isUnbranched: boolean,
  needsReconciliation: boolean  // reconciliation_status === 'STALE'
}
```

#### Actions

**`reconcileLine`** — NEW
- `requireAdmin()`
- Params: `billingLineId`, `newSkuId?`, `newWidthIn?`, `newQty?`, `newLengthFt?`
- Calls `reconcileBillingLine()` from `cutdown.js`
- On success: redirects back to `/wo/[id]/diff`
- On error: returns `fail(400, { error })`

**`splitLine`** — NEW
- `requireAdmin()`
- Params: `billingLineId`, `newLines` (serialized JSON array of `{ skuId, widthIn, qty, lengthFt }`)
- Calls `splitBillingLine()` from `cutdown.js`
- On success: redirects back to `/wo/[id]/diff`
- On error: returns `fail(400, { error })`

#### UI Notes
- Side-by-side layout: **Billing** column left, **Production** column right
- Each row in the diff represents one billing/unbranched line and its production children
- Unbranched lines show the same data in both columns (no diff)
- STALE rows are highlighted amber with an inline reconciliation form:
  - Fields: SKU selector, width, qty, length_ft — only changed fields need values
  - Two buttons: **Reconcile** (simple update) and **Split Line** (opens a sub-form for complex split)
- SUPERSEDED lines shown collapsed with a `Superseded` badge — expandable for history
- RECONCILED lines shown with a green badge — no action available
- Breadcrumb: `Work Orders > {so_number} > Diff`

---

### `/wo/[id]/schedule` — Schedule Production Runs [MODIFIED]

#### `load({ params })`
Fetches (existing + additions):
- Work order with lines (existing)
- **Filter lines**: only show lines where derived `line_type = PRODUCTION` or `line_type = UNBRANCHED`
- **Exclude**: billing lines (they are not scheduled for production runs)
- For each production line, check if a confirmed cut-down exists — pass `cutDownConfirmed: boolean` per line
- Existing scheduling data (run groups, dates)

Returns: `{ wo, scheduleableLines, existingGroups }`

#### Actions

**`scheduleGroup`** — existing, unchanged in signature
- Now only accepts `woLineId` values that are PRODUCTION or UNBRANCHED lines
- Server-side guard: throw if a billing line id is passed

#### UI Notes
- Lines without a confirmed cut-down show a soft warning: `"No confirmed cut-down — material may not be ready"`
- Warning does not block scheduling (soft gate)
- Billing lines are not shown on this page at all

---

### `/wo/[id]/confirm` — Confirm Production Runs [MODIFIED]

#### `load({ params })`
Fetches (existing + additions):
- Completed/scheduled production runs for this WO (existing)
- For each run, the derived `line_type` of its `wo_line_id`
- For each PRODUCTION line run, whether a confirmed cut-down exists (`cutDownConfirmed: boolean`)
- Existing confirmation data

Returns: `{ wo, runs }` where each run includes `lineType` and `cutDownConfirmed`

#### Actions

**`confirm`** — MODIFIED
- `requireAdmin()`
- Existing params: `runId`, `rollsActual`, `runDate`
- Calls `confirmRun()` from `runs.js` (which now routes to WIP ledger vs inventory based on line type)
- If `lineType = PRODUCTION` and `cutDownConfirmed = false`: returns `fail(400, { error: 'No confirmed cut-down. Admin override required.' })` unless `adminOverride = true` param is present
- Admin override: accepted as a form param `adminOverride: 'true'` — requires `requireAdmin()` (already called)

**`remove`** — existing, unchanged

#### UI Notes
- Production line runs where `cutDownConfirmed = false` show an amber warning badge
- Admin override checkbox appears on those runs: `"Confirm without cut-down (admin override)"`
- Billing lines never appear on this page

---

### `/wo/[id]/branch` — Branch a Line [NEW]

#### `load({ params, url })`
Fetches:
- Work order header
- The specific line to branch: `lineId` from query param `?lineId=`
- Available SKUs (for production line SKU — inherited from billing but shown for reference)
- Validates line is unbranched (`parent_line_id IS NULL`, no children, no existing production runs)

Returns: `{ wo, line, skus }`

#### Actions

**`branch`** — NEW
- `requireAdmin()`
- Params: `woLineId`, `productionWidths` (array of `{ width_in, qty, length_ft }` from repeating form fields)
- Validates each `width_in <= line.width_in`
- Calls `branchLine()` from `cutdown.js`
- On success: redirects to `/wo/[id]` (production tab)
- On error: returns `fail(400, { error })`

#### UI Notes
- Shows the billing line fields (read-only): SKU, thickness, width, qty, length_ft, facing, rollfor
- Dynamic form: user adds one row per production width
  - Each row: `width_in` (required), `qty` (defaults to billing qty), `length_ft` (defaults to billing length_ft)
  - `+` button to add a row, `×` to remove
- Running waste calculator shown below the form:
  - `Source width: 48"`
  - `Cut widths: 30" + 13" = 43"`
  - `Waste: 5"` — shown in amber if waste > 0
- Validation: sum of cut widths must be <= source width
- Equal-cut shortcut: user can enter one width and a count, which auto-expands to multiple identical rows
- Submit button: **Branch Line**
- Cancel link: back to `/wo/[id]`

---

### `/wo/[id]/cutdown` — Manage Cut-Down Orders [NEW]

#### `load({ params })`
Fetches:
- Work order header
- All billing lines for this WO with their production children
- All cut-down orders for this WO (`cut_downs` joined to `cut_down_groups`)
- For each cut-down, its status and associated billing line summary
- Available SKUs (for SKU selector on schedule form)

Returns: `{ wo, billingLines, cutDowns, skus }`

#### Actions

**`scheduleCutDown`** — NEW
- `requireAdmin()`
- Params: `billingLineId`, `rollsScheduled`, `runDate?`
- Calls `scheduleCutDown()` from `cutdown.js`
- On success: reloads page (invalidate)
- On error: `fail(400, { error })`

**`scheduleCutDownGroup`** — NEW
- `requireAdmin()`
- Params: `items` (array of `{ billingLineId, rollsScheduled }`), `runDate?`
- Calls `scheduleCutDownGroup()` from `cutdown.js`
- On success: reloads page
- On error: `fail(400, { error })`

**`deleteCutDown`** — NEW
- `requireAdmin()`
- Params: `cutDownId`
- Calls `deleteCutDown()` from `cutdown.js`
- Guard: throws if `status = COMPLETED`
- On success: reloads page
- On error: `fail(400, { error })`

#### UI Notes
- Page is split into two panels:
  - **Left**: list of billing lines with their cut-down status summary
    - Each billing line shows: SKU, width, qty, current cut-down status badge
    - `+ Schedule Cut-Down` button per billing line
    - Batch schedule button at the top: **Schedule Group**
  - **Right**: list of all cut-down orders for this WO
    - Each cut-down shows: cut_down_number (internal, not shown), billing line summary, run_date, status badge, rolls_scheduled
    - Actions per cut-down: **Confirm** (links to `/wo/[id]/cutdown/[cutDownId]/confirm`), **Delete** (UNSCHEDULED/SCHEDULED only)
- Breadcrumb: `Work Orders > {so_number} > Cut-Downs`

---

### `/wo/[id]/cutdown/[cutDownId]/confirm` — Confirm Cut-Down [NEW]

#### `load({ params })`
Fetches:
- Work order header
- The specific cut-down row with billing line and production children
- Billing line SKU details
- Production line details (width_in per child, for WIP CUT_IN preview)

Returns: `{ wo, cutDown, billingLine, productionLines }`

#### Actions

**`confirmCutDown`** — NEW
- `requireAdmin()`
- Params: `cutDownId`, `rollsActual`, `sqftActual?`, `wasteActual?`, `sourceRollCount?`, `scrapDisposition` (SAVED | DISCARDED | DELIVERED), `operatorNotes?`
- Calls `confirmCutDown()` from `cutdown.js`
- On success: redirects to `/wo/[id]/cutdown`
- On error: `fail(400, { error })`

**`unconfirmCutDown`** — NEW
- `requireAdmin()`
- Params: `cutDownId`
- Calls `unconfirmCutDown()` from `cutdown.js`
- On success: returns warning list if downstream runs or shipments exist, redirects to `/wo/[id]/cutdown`
- On error: `fail(400, { error })`

#### UI Notes
- Form fields:
  - `rolls_actual` (required)
  - `sqft_actual` (optional — auto-calculated from rolls if omitted, shown as preview)
  - `waste_sqft_actual` (optional)
  - `source_roll_count` (optional)
  - `scrap_disposition` — radio buttons: **Save in-house**, **Discard**, **Deliver with order**
  - `operator_notes` — textarea
- WIP preview panel: shows the CUT_IN entries that will be written to the WIP ledger on confirmation
  - One row per production child: `width_in`, estimated `sqft_quantity` (prorated)
- If cut-down is already COMPLETED: show confirmation details read-only with an **Unconfirm** button
- Unconfirm shows a warning modal if downstream production runs or shipments exist:
  - `"The following runs will lose their WIP material: PR-20260501-001, PR-20260501-002"`
  - `"Confirm unconfirm?"` — Yes / Cancel
- Breadcrumb: `Work Orders > {so_number} > Cut-Downs > Confirm`

---

### `/wo/[id]/address` — Edit Shipping Address [UNCHANGED]

No changes required.

---

### `/wo/import` — Import Work Orders [UNCHANGED]

No changes required.

---

### `/wip` — WIP Ledger Overview [NEW]

#### `load()`
Fetches:
- All `wip_ledger` entries grouped by `cut_down_id`
- For each cut-down, its associated work order (`so_number`, `job_name`) and billing line summary
- Current WIP balance per cut-down: `SUM(sqft_quantity)` — positive balance = available scrap
- Filter: only show entries where balance > 0 (saved scrap available) by default; toggle to show all

Returns: `{ wipEntries }` where each entry includes:
```js
{
  cutDownId,
  soNumber,
  jobName,
  widthIn,
  balance,        // current sqft available
  cutDownStatus,
  confirmedAt
}
```

#### Actions

**`assignScrap`** — NEW
- `requireAdmin()`
- Params: `sourceCutDownId`, `destinationWoLineId`, `sqftToAssign`
- Calls `assignScrap()` from `cutdown.js`
- Width tolerance warning returned as `{ warning }` in action result if applicable — user must confirm
- On success: reloads page
- On error: `fail(400, { error })`

#### UI Notes
- Filterable list of available WIP scrap:
  - Columns: Job (so_number + job_name), Width, Available Sqft, Cut-Down Date
  - Filter by width range, job, date
- Each row has an **Assign to Line** button that opens an inline form:
  - WO selector → then line selector (filtered to production lines of that WO with matching width tolerance)
  - Sqft to assign (defaults to full available balance)
  - Width mismatch warning shown inline if within tolerance but not exact: `"Scrap is 15" — destination line requires 13". 2" overage within tolerance."`
  - Submit: **Assign Scrap**
- Navigation link in sidebar under **Inventory** or **Production** section
- Breadcrumb: `WIP Ledger`

---

## Summary of New Routes

| Route | Purpose | Admin Only |
|---|---|---|
| `/wo/[id]/diff` | Diff view + reconciliation | Yes (actions) |
| `/wo/[id]/branch` | Branch a line | Yes |
| `/wo/[id]/cutdown` | Manage cut-down orders | Yes |
| `/wo/[id]/cutdown/[cutDownId]/confirm` | Confirm/unconfirm a cut-down | Yes |
| `/wip` | WIP scrap ledger + assignment | Yes (actions) |

## Summary of Modified Routes

| Route | What Changed |
|---|---|
| `/wo` | Stale indicator + branch indicator on list rows |
| `/wo/[id]` | Tabbed billing/production line view; completeWo action; branch + diff links |
| `/wo/[id]/schedule` | Filters to production + unbranched lines only; cut-down warning |
| `/wo/[id]/confirm` | Path-aware confirm; admin override for missing cut-down |
