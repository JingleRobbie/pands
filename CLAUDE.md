# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
