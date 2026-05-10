# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server at http://localhost:5173 (hot reload)
npm run build        # Build for production → build/
npm run build:css    # Compile Tailwind CSS (minified) → static/css/app.css
npm run watch:css    # Watch and recompile Tailwind on src/app.css changes
npm run seed         # Seed SKUs into MySQL (run once after schema creation)

node build/index.js  # Run production server (set PORT env var, default 3000)
```

**First-time database setup:**

```bash
mysql -u root -p < db/schema.sql   # Create DB + tables + Admin user
npm run seed                        # Insert material SKUs
```

**Tailwind note:** Svelte templates don't auto-recompile CSS — run `npm run build:css` after editing `src/app.css` or adding new Tailwind classes.

## Environment

`.env` file at project root with these keys:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=pands
```

> **Note:** Escape `$` in passwords with `\$` -- Vite's dotenv-expand treats `$word` as a variable reference and silently strips it (e.g. write `DB_PASSWORD=Tak3me2\$hurch`, not `Tak3me2$hurch`).

## Architecture

### Stack

SvelteKit + mysql2 (promise API) + MySQL + Tailwind CSS v3. No TypeScript. Deployed via `@sveltejs/adapter-node` as a plain Node.js server on Windows.

### Session / Auth

No passwords. `hooks.server.js` reads an `app_user_id` cookie on every request, queries `app_users`, and attaches the user to `event.locals.appUser`. Any route without a valid user is redirected to `/` (the who-are-you picker screen). The cookie is set by the `/` form action and deleted by `GET /logout`.

### Data model — key relationships

```
purchase_orders → purchase_order_lines → material_skus
sales_orders    → sales_order_lines    → material_skus
                                         ↕
                               production_runs (links so_line_id → sales_order_lines)
                                         ↕
                               inventory_transactions (append-only ledger)
```

Inventory balance is **never stored** — it is always derived by summing `inventory_transactions` (RECEIPT + ADJUSTMENT_IN minus CONSUMPTION + ADJUSTMENT_OUT) per SKU. All sqft values are `INT` (whole sq ft only).

### Business logic services (`src/lib/services/`)

All DB mutations go through these three files — routes call services, not raw SQL:

- **`inventory.js`** — `getAllBalances()` (aggregate query), `getMatrixData()` (the full matrix: current balances + dated PO/production rows + unscheduled SO rows with running totals per SKU column)
- **`purchasing.js`** — `receivePoLine()` — atomic: creates RECEIPT transaction, marks line/PO received
- **`production.js`** — `scheduleRun()` — atomic: validates unscheduled sqft, creates production_run; `confirmRun()` — atomic: creates CONSUMPTION transaction, marks run confirmed, updates `sqft_produced`, closes SO if complete

All three service functions use `conn.beginTransaction()` / `conn.commit()` / `conn.rollback()`.

### Matrix screen (`/matrix`)

The central daily-use screen. `getMatrixData()` returns `{ skus, balanceRow, rows }`. Rows are sorted: PO arrival rows before production run rows on the same date. Unscheduled SO lines appear at the bottom with `?` date. Each row's `cells[skuId]` contains `{ delta, runningTotal }`. Negative running totals render red via `.sqft-negative`.

### CSS component classes

Defined in `src/app.css` as Tailwind `@layer components`. Use these rather than raw utility strings:

- Buttons: `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-sm`
- Badges: `.badge-green`, `.badge-amber`, `.badge-red`, `.badge-blue`, `.badge-gray`
- Forms: `.form-label`, `.form-input`, `.form-select`
- Layout: `.card`, `.card-header`, `.card-body`
- Matrix: `.matrix-table`, `.row-po`, `.row-production`, `.row-unscheduled`, `.row-balance`, `.sqft-negative`, `.sqft-positive`

### SvelteKit patterns used

- **Svelte 5 runes** (`$state`, `$derived`, `$props`, `$effect`) — no legacy `let`/`$:` reactive syntax
- **`use:enhance`** on all forms for progressive enhancement
- **Form actions** (`export const actions = { default: ... }`) for all POSTs
- `+page.server.js` handles load + actions; `+page.svelte` is display only
- `+server.js` used for the calendar events JSON endpoint (`GET /calendar/events`)
- `$lib` alias maps to `src/lib/`
- DB credentials read via `$env/static/private` (SvelteKit's server-only env)

### SKUs

22 active SKUs defined in `scripts/seed-skus.js`. Identified by thickness × width (e.g. `3"×48"`). SKU code is a short string like `3048`. `sort_order` controls column order in the matrix.

## Coding Patterns

### Error Handling

- **Load functions** — let DB errors throw naturally. SvelteKit catches and shows the error page. No try/catch in load.
- **Form actions** — use `fail()` for all user-facing errors. Never throw in actions.
- **Services** — all mutations catch errors, call `conn.rollback()`, then re-throw. The calling action catches and returns `fail(500, ...)`.

```javascript
// +page.server.js — action error handling
import { fail, redirect } from '@sveltejs/kit';

export const actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const qty = parseInt(data.get('qty'));
		if (!qty || qty < 1) return fail(400, { error: 'Invalid quantity' });
		try {
			await someService.doThing(qty, locals.appUser.id);
		} catch (err) {
			return fail(500, { error: err.message });
		}
		redirect(303, '/somewhere');
	},
};
```

```svelte
<!-- +page.svelte — error display -->
{#if form?.error}
	<p class="text-red-600 text-sm">{form.error}</p>
{/if}
```

### Svelte Template Rules

**Keyed `{#each}` blocks** — always include a key expression. ESLint enforces this as an error.

```svelte
{#each items as item (item.id)}   <!-- ✓ keyed by id -->
{#each items as item, i (i)}      <!-- ✓ keyed by index when no stable id -->
{#each items as item}             <!-- ✗ ESLint error -->
```

**Labels** — always use explicit `for` + matching `id`, not implicit wrapping. The svelte ESLint plugin has no enforcement for this, so it is a manual convention.

```svelte
<!-- ✓ explicit association -->
<label for="qty" class="form-label">Quantity</label>
<input id="qty" name="qty" class="form-input" />

<!-- ✗ avoid — implicit wrapping not caught by linter -->
<label class="form-label">
	Quantity
	<input name="qty" class="form-input" />
</label>
```

### Svelte 5 Runes

Always use runes — never legacy `let`/`$:` reactive syntax.

```javascript
let { data, form } = $props(); // props
let lines = $state([{ sku_id: '', sqft: '' }]); // reactive state
let total = $derived(lines.reduce((s, l) => s + (parseInt(l.sqft) || 0), 0)); // computed
$effect(() => {
	/* runs when dependencies change */
}); // side effects
```

`$state` arrays: reassign to trigger reactivity (`lines = [...lines, newItem]`) or mutate in place (both work in Svelte 5).

### Database Patterns

```javascript
import db from '$lib/db.js';

// Read — use pool directly
const [rows] = await db.query('SELECT ...', [params]);

// Write — always get a connection and use a transaction
const conn = await db.getConnection();
try {
	await conn.beginTransaction();
	await conn.query('INSERT ...', [params]);
	await conn.query('UPDATE ...', [params]);
	await conn.commit();
} catch (err) {
	await conn.rollback();
	throw err;
} finally {
	conn.release();
}
```

`decimalNumbers: true` is set on the pool — numeric columns come back as JS numbers, not strings.

### New Route Template

**`src/routes/<name>/+page.server.js`:**

```javascript
import { fail, redirect } from '@sveltejs/kit';
import db from '$lib/db.js';

export async function load({ locals }) {
	const [rows] = await db.query('SELECT ...');
	return { rows };
}

export const actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		// validate → fail(400, { error }) on bad input
		// service call → fail(500, { error }) on error
		redirect(303, '/<name>');
	},
};
```

**`src/routes/<name>/+page.svelte`:**

```svelte
<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<form method="POST" use:enhance>
	{#if form?.error}<p class="text-red-600 text-sm">{form.error}</p>{/if}
	<!-- .form-label, .form-input, .form-select -->
	<button type="submit" class="btn-primary">Submit</button>
</form>
```

Add a nav link in `src/routes/+layout.svelte`. All mutations go through a service in `src/lib/services/`.

### Formatting Utilities

Use `src/lib/utils.js` — do not inline formatting logic in components.

```javascript
import { fmtDate, fmtSqft } from '$lib/utils.js';
fmtDate('2026-04-07'); // → "Apr 7, 2026"
fmtSqft(12345); // → "12,345"
```

### Adding a New SKU

Edit `scripts/seed-skus.js` — add an entry with a unique `sku_code`, `thickness`, `width`, and `sort_order`. Then run `npm run seed`.


<claude-mem-context>
# Memory Context

# [PandS] recent context, 2026-05-09 11:40pm CDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (15,303t read) | 676,357t work | 98% savings

### May 9, 2026
191 3:49p ⚖️ WO detail lines table UI redesign: merge Type column into Width cell
192 " ✅ Removed Type column header from WO lines table
193 3:50p ✅ Removed Type data cells from billing/unbranched lines table
194 " 🟣 Width cell redesigned to show branched cuts inline with badges
195 " ✅ Fixed total row colspan after Type column removal
196 3:54p 🔴 Fixed Svelte const tag invalid placement error in work order table
197 4:00p 🔵 Unknown 'active' column in work order diff query
198 " 🔴 Remove non-existent 'active' column filter from material_skus query
199 4:34p ✅ Diff page UI refactored to compact billing/production display
200 7:56p 🔴 Fixed HTML entity escaping in placeholder attributes on branch page
201 7:57p ✅ Committed step 11: diff view layout and WO billing tab width display
S48 Filter cutdown page to show only lines eligible for cut-down operations (May 9, 7:57 PM)
202 8:38p ✅ Filter cutdown page to show only eligible lines
S49 Filter cutdown page to show only lines eligible for cut-down (May 9, 8:39 PM)
203 8:40p ✅ Add production lines query to cutdown page
204 8:41p ✅ Add production lines to cutdown page UI with parent mapping
205 " 🟣 Display production lines under each billing line in cutdown page
206 " ✅ Remove redundant child_count check from button visibility
S50 Commit step 12 (cutdown page with billing->production line display), then identify next layer (May 9, 8:41 PM)
207 8:53p 🟣 Cutdown page billing and production line display
S51 Update docs/cutdown/01_feature_spec.md to clarify user-facing terminology for line types (UNBRANCHED/BILLING/PRODUCTION) (May 9, 8:53 PM)
S52 Update docs/cutdown/01_feature_spec.md with spec-level decisions from session (May 9, 9:01 PM)
208 9:02p ✅ Added user-facing terminology clarification to feature spec
S53 Update docs/cutdown/01_feature_spec.md to document spec-level decisions from session (May 9, 9:03 PM)
209 9:03p ✅ Committed feature spec clarification to main branch
S54 Clarification on sqft_scheduled semantics: planned raw source sqft may exceed billing line sqft due to raw roll count rounding up; need architectural decision on field meaning, consumption basis, and overage tracking. (May 9, 9:03 PM)
210 9:09p 🔵 Cut-Down feature implemented across schema, services, and UI
211 9:28p 🔄 Extracted cutdown line-path helpers into shared service
214 10:26p ⚖️ Lookup table strategy for insulation product lengths
215 10:36p 🔵 sqft_scheduled vs billing line sqft relationship clarified
S55 Review plan and implement if 90% confident; implementation plan created for multi-file refactor involving migration, schema, seed data, service layer, and API routes (May 9, 10:36 PM)
216 10:39p ⚖️ Raw roll lookup implementation plan for cut-down scheduling
217 10:40p 🔵 Current cut-down scheduling UI and API accept manual roll counts
218 " 🔵 Project uses numbered migration files for schema changes
219 " 🔵 Confirmation flow collects actual rolls/sqft and scrap disposition
S56 Review and implement cut-down scheduling refactor: replace manual rolls input with vendor-driven auto-calculation and fix WIP allocation to prorate usable output sqft instead of raw source sqft. (May 9, 10:44 PM)
220 10:46p 🟣 Raw Roll Lookup Migration Created
221 10:47p ✅ Schema Updated with Raw Roll Lookup Table
222 " ✅ cut_downs Table Extended with Raw Roll Tracking
223 " ✅ cut_downs Foreign Key Constraint Added
224 " ✅ Seed Data Updated with R-Value Mappings
225 10:48p 🟣 Raw Roll Lookup Seeding Added to Seed Script
226 " 🔄 Cut-down Service Refactored for Raw Roll Auto-Calculation
227 " 🔄 Group Cut-down Scheduling Updated for Raw Roll Auto-Calculation
228 10:52p 🔴 Cut-down WIP allocation now uses usable output sqft instead of raw source sqft
229 " ✅ Raw roll lookup data added to cut-down page load
230 " ✅ Cut-down scheduling action signature updated to use vendor parameter
231 " ✅ Added inline documentation for scheduleCutDownGroup items format
232 " 🟣 UI now supports vendor selection with roll preview calculations
233 " 🟣 Cut-down scheduling form redesigned with vendor selection and roll preview
234 10:53p ✅ Cut-down confirmation page preview now uses billing line sqft (usable output)
235 10:57p 🔵 Svelte {@const} tag placement violation in cutdown route
S57 Fix Svelte compilation error: {@const} tag invalid placement in cutdown page (May 9, 10:57 PM)
236 11:01p 🟣 Raw roll lookup system for cut-down scheduling
237 11:02p 🔵 Lint error: missing key on roll preview each block
238 11:13p ⚖️ Cut-down overage and source rolls simplification
239 11:14p 🟣 Cut-down overage and field refactoring implemented
242 11:26p ⚖️ Cut-down duplicate policy: Block duplicates
243 11:30p 🟣 Duplicate and blocking validation for cut-down group scheduling
244 11:32p 🟣 Database schema migration for raw roll lookup completed

Access 676k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>