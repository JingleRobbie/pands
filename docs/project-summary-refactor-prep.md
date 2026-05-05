# PandS Project Summary and Refactor Prep

## Purpose

PandS is an internal operations app for insulation inventory planning. It tracks material SKUs, purchase orders, imported work orders, scheduled and completed production, shipments, inventory counts, and calendar views.

The daily center of gravity is the matrix/overview screen: it shows current balance by SKU, recent historical activity, upcoming PO supply, scheduled production demand, and unscheduled WO demand.

## Stack

- SvelteKit with Svelte 5 runes
- MySQL with `mysql2/promise`
- Tailwind CSS v3 with component classes in `src/app.css`
- Adapter-node production build
- Vitest for unit tests

## Runtime Shape

- `src/hooks.server.js` loads `event.locals.appUser` from the `app_user_id` cookie.
- `/login` authenticates active `app_users` with bcrypt password hashes.
- Route `+page.server.js` files handle loads and form actions.
- Svelte pages are mostly display and interaction layers.
- Business mutations should live in `src/lib/services/`.
- `db/schema.sql` is now the current fresh-install schema.

## Data Model

Core tables:

- `material_skus` defines active SKU columns.
- `purchase_orders` and `purchase_order_lines` represent inbound material.
- `work_orders` and `work_order_lines` represent customer demand imported from Excel WOs.
- `production_runs` schedules and confirms production against WO lines.
- `production_run_groups` groups same-day multi-line schedules.
- `inventory_transactions` is the append-only inventory ledger.
- `inventory_counts` groups count adjustments.
- `customers`, `contacts`, `customer_addresses`, `shipments`, `shipment_lines`, and `wo_accessories` support shipping and customer workflows.

Legacy `sales_orders` and `sales_order_lines` still exist but the current production flow is work-order based.

## Business Rules to Preserve

- Inventory balance is derived, not stored.
- Sqft quantities are whole-number integers.
- Production consumption is recorded through `inventory_transactions`.
- Past PO lines count toward balance once expected date has passed unless cancelled.
- Confirming a production run cannot happen before its run date.
- Short production creates a new unscheduled run for the remaining rolls.
- Shipping can split completed production runs when only part of a run ships.
- Work-order imports must preserve lines, contacts, delivery address fields, accessories, and tab type.
- Admin-only actions include inventory counts and WO import commit.

## Current Hotspots

### `src/lib/services/inventory.js`

Largest service. It mixes balance math, matrix row construction, historical rows, SKU-filtered variants, and inventory count writes.

Refactor direction:

- Extract shared row/cell builders.
- Remove duplication between `getMatrixData()` and `getMatrixDataForSkus()`.
- Split historical activity helpers into a focused module if changes continue.
- Add unit tests around balance calculations and matrix ordering before larger edits.

### `src/lib/services/shipping.js`

Contains repeated logic for splitting completed production runs when partially shipping or reducing shipped rolls.

Refactor direction:

- Extract a single `splitCompletedRun()` helper.
- Centralize sqft proration and validation.
- Add tests for full shipment, partial shipment, and edit/confirm reductions.

### `src/lib/services/production.js`

Core transactional logic is sound but scheduling has duplicate validation between single-line and group scheduling.

Refactor direction:

- Extract remaining-roll validation and sqft calculation helpers.
- Consider whether `scheduleRun()` is still needed or can delegate to `scheduleGroup()`.
- Keep transactions and `FOR UPDATE` locking intact.

### Routes with Direct SQL

Many routes correctly use direct SQL for reads, but some actions still mutate directly.

Refactor direction:

- Leave simple read loads alone unless they become hard to maintain.
- Move multi-step mutations into services.
- Keep route actions responsible for form parsing, validation, `fail()`, and redirects.

### Large Svelte Pages

Several pages are large enough to make behavior changes risky:

- `src/routes/wo/[id]/confirm/+page.svelte`
- `src/routes/shipments/[id]/edit/+page.svelte`
- `src/routes/+layout.svelte`
- `src/routes/wo/import/+page.svelte`
- `src/routes/matrix/+page.svelte`
- `src/routes/wo/[id]/+page.svelte`

Refactor direction:

- Extract small presentational components only when there is a clear boundary.
- Preserve form names/actions exactly during UI decomposition.
- Avoid visual redesign during logic refactors.

## Suggested Refactor Order

1. Add focused tests for existing utility/business behavior.
2. Extract pure helpers from `shipping.js` because the duplication is obvious and contained.
3. Extract pure helpers from `production.js` while preserving transaction boundaries.
4. Tackle `inventory.js` matrix duplication with tests in place.
5. Move any remaining multi-step route mutations into services.
6. Split large Svelte pages only after their server behavior is stable.

## Verification Checklist

For each refactor:

- Run `npm run test`.
- Run `npm run lint` when Svelte or route code changes.
- If Tailwind classes or `src/app.css` change, run `npm run build:css`.
- For user-facing Svelte changes, run the dev server and inspect affected flows in the browser.
- For schema or query changes, verify against the live DB shape or a temporary database.

## Known Environment Notes

- `rg` currently fails in this Codex sandbox with `Access is denied`; use PowerShell search/listing as fallback.
- `npm run test` may fail inside the Codex sandbox with `spawn EPERM`, but it passes in a normal local terminal.
- The working tree currently includes local agent/Codex files and README/schema documentation changes.
