# Plan: Stock Orders & Non-Production Orders

## Context

Two new order variants need to be supported alongside existing standard WOs:

- **Stock Orders** — internal inventory builds with no customer SO. Imported via Excel WO. Can span multiple non-consecutive production runs. Appear in `/wo` list. Identified by a user-entered label like "TULSA STOCK 05-18-26".
- **Non-Production Orders (NPO)** — customer orders (have SO#) but no WO to import. Raw/unprocessed material, shipped in one event with no production run. Managed at `/npo` (separate route, not in `/wo` list).

---

## Schema Migration

**File:** `db/schema.sql` + new migration file `db/migrations/add_order_type.sql`

```sql
ALTER TABLE work_orders
  ADD COLUMN order_type ENUM('STANDARD','STOCK','NON_PRODUCTION') NOT NULL DEFAULT 'STANDARD';
```

No other schema changes needed. NPO lines reuse `work_order_lines` with `facing = 'RAW'`, `parent_line_id = NULL` (unbranched/DIRECT_SHIP path).

---

## 1. WO Import — Stock Order Support

**File:** `src/routes/wo/import/+page.server.js` + `+page.svelte`

- Add "Stock Order" checkbox to the import form UI
- When checked, reveal a text field for the stock identifier (e.g. "TULSA STOCK 05-18-26") — this overrides the filename-extracted SO number
- In `parse` action: if `is_stock_order = true`, use user-entered identifier instead of `file.name.split(/\s/)[0]`
- In `import` action: pass `order_type: 'STOCK'` in the `INSERT INTO work_orders` when stock order flag is set

---

## 2. /wo List — Stock Order Display

**File:** `src/routes/wo/+page.server.js`

- Add `wo.order_type` to SELECT
- Exclude `order_type = 'NON_PRODUCTION'` from query (WHERE clause): `wo.order_type != 'NON_PRODUCTION'`

**File:** `src/routes/wo/+page.svelte`

- Show `.badge-blue` "STOCK" badge next to so_number for stock orders

---

## 3. NPO Service

**New file:** `src/lib/services/npo.js`

```javascript
export async function createNPO({ soNumber, customerId, jobName, shipDate, shipAsap, lines }, userId)
// Transaction: INSERT work_orders (order_type='NON_PRODUCTION') + INSERT work_order_lines (facing='RAW', path_type='DIRECT_SHIP')
// Returns: { woId }
```

Lines shape: `[{ skuId, thicknessIn, widthIn, qty, lengthFt, sqft }]`

---

## 4. /npo Routes

### `/npo` — List

**New files:** `src/routes/npo/+page.server.js`, `src/routes/npo/+page.svelte`

- Query `work_orders WHERE order_type = 'NON_PRODUCTION'`
- Show SO#, customer, job, ship date, status (OPEN/COMPLETE)
- Link to `/npo/[id]`
- "New NPO" button → `/npo/new`

### `/npo/new` — Create

**New files:** `src/routes/npo/new/+page.server.js`, `src/routes/npo/new/+page.svelte`

- Load: fetch customers list + active SKUs
- Form fields: SO#, customer (select), job name, ship date / ASAP toggle
- Dynamic line table: add/remove rows, each row has SKU select + qty + length_ft (sqft auto-calculated)
- Action: validate → call `createNPO(...)` → redirect to `/npo/[id]`

### `/npo/[id]` — Detail

**New files:** `src/routes/npo/[id]/+page.server.js`, `src/routes/npo/[id]/+page.svelte`

- Load: WO record + lines + existing shipments for this WO
- Show lines table (SKU, qty, length, sqft, shipped status)
- "Create Shipment" button → links to `/shipments/new?wo=[id]` (existing flow handles DIRECT_SHIP lines natively)
- No production or cut-down sections (not applicable)

---

## 5. Shipment Creation — NPO Compatibility

**File:** `src/routes/shipments/new/+page.server.js`

No changes needed — the existing `directLines` query already fetches unbranched WO lines not yet on a shipment. NPO lines are unbranched with `parent_line_id = NULL`, so they appear automatically when `/shipments/new?wo=[npo_wo_id]` is loaded.

Only verify: the load doesn't filter by `order_type`. (It doesn't — it filters by `wo.id`.) ✓

---

## 6. Nav

**File:** `src/routes/+layout.svelte`

- Add link: `Non-Production` → `/npo`

---

## File Touch Summary

| File | Change |
|------|--------|
| `db/migrations/add_order_type.sql` | New — ALTER TABLE |
| `src/routes/wo/import/+page.server.js` | Stock order toggle + identifier field |
| `src/routes/wo/import/+page.svelte` | UI for stock order toggle |
| `src/routes/wo/+page.server.js` | Exclude NPO, add order_type to SELECT |
| `src/routes/wo/+page.svelte` | STOCK badge |
| `src/lib/services/npo.js` | New — createNPO() |
| `src/routes/npo/+page.server.js` | New — NPO list load |
| `src/routes/npo/+page.svelte` | New — NPO list UI |
| `src/routes/npo/new/+page.server.js` | New — create form load + action |
| `src/routes/npo/new/+page.svelte` | New — create form UI |
| `src/routes/npo/[id]/+page.server.js` | New — NPO detail load |
| `src/routes/npo/[id]/+page.svelte` | New — NPO detail UI |
| `src/routes/+layout.svelte` | Add /npo nav link |

---

## Verification

1. Run migration SQL against dev DB
2. Import a stock WO: check checkbox, enter "TULSA STOCK 05-18-26", import — verify WO appears in `/wo` with STOCK badge and `order_type = 'STOCK'` in DB
3. Create NPO at `/npo/new` — verify `work_orders` row has `order_type = 'NON_PRODUCTION'`, lines inserted
4. From `/npo/[id]`, click "Create Shipment" — verify `/shipments/new?wo=[id]` shows NPO lines in directLines section
5. Complete shipment — verify shipment created, NPO lines marked shipped
6. Confirm standard WOs unaffected (`order_type = 'STANDARD'`, existing production/cut-down flows unchanged)

---

## Open Questions

- When all lines on a Stock Order are shipped, should it auto-complete (like standard WOs), or require manual completion?
- Should NPOs support partial shipments (ship some lines now, rest later)?
- Should `/npo/[id]` allow editing lines after creation, or is that out of scope for now?
