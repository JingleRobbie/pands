# PandS Inventory Tracker

Internal SvelteKit app for tracking insulation material inventory, purchase orders, work orders, production runs, shipments, and inventory counts.

## Stack

- **SvelteKit + Svelte 5** - frontend, server-side rendering, form actions
- **MySQL 8+** - operational database
- **mysql2/promise** - database access
- **Tailwind CSS v3** - styling and component classes
- **Node.js** - production server via `@sveltejs/adapter-node`

## Setup

### Prerequisites

- Node.js 20+
- MySQL 8+

### First-Time Setup

1. Install dependencies:

    ```bash
    npm install
    ```

2. Create `.env` at the project root:

    ```env
    DB_HOST=localhost
    DB_PORT=3306
    DB_USER=your_user
    DB_PASSWORD=your_password
    DB_NAME=pands
    ```

    If the password contains `$`, escape it as `\$`. Vite dotenv expansion treats `$word` as a variable reference.

3. Create the database and seed SKUs:

    ```bash
    mysql -u root -p < db/schema.sql
    npm run seed
    ```

4. Apply any needed migrations in `db/migrations/` for existing installs.

5. Build CSS:

    ```bash
    npm run build:css
    ```

## Development

```bash
npm run dev        # Start dev server at http://localhost:5173
npm run watch:css  # Recompile Tailwind when src/app.css changes
```

Svelte templates do not automatically rebuild the generated Tailwind file. Run `npm run build:css` after editing `src/app.css` or adding classes that need to exist in `static/css/app.css`.

## Scripts

| Script                 | Description                            |
| ---------------------- | -------------------------------------- |
| `npm run dev`          | Start Vite dev server                  |
| `npm run build`        | Build the SvelteKit app for production |
| `npm run preview`      | Preview the built app                  |
| `npm run build:css`    | Compile minified Tailwind CSS          |
| `npm run watch:css`    | Watch and compile Tailwind CSS         |
| `npm run seed`         | Seed material SKUs                     |
| `npm run seed:history` | Seed historical/sample inventory data  |
| `npm run lint`         | Run ESLint                             |
| `npm run format`       | Format all files with Prettier         |
| `npm run format:check` | Check formatting without writing       |
| `npm run test`         | Run Vitest unit tests                  |
| `npm run test:watch`   | Run Vitest in watch mode               |

## Production

```bash
npm run build
npm run build:css
node build/index.js   # PORT defaults to 3000
```

## App Areas

- **Overview / Matrix** - current inventory, historical activity, incoming POs, scheduled production, and unscheduled WO demand by SKU.
- **Purchase Orders + Receiving** - create/import POs and receive material.
- **Work Orders** - import Excel work orders, manage lines, contacts, addresses, accessories, and schedule production.
- **Production** - view scheduled/unscheduled runs and confirm completed production.
- **Customers** - customer records and links to work orders.
- **Shipments** - draft and confirm shipments from completed production runs.
- **Calendars** - production calendar and shipment calendar.
- **Inventory Counts** - admin-only inventory adjustment batches.
- **Settings** - user and app preferences.

## Architecture Notes

- `src/routes/` contains SvelteKit pages, form actions, and JSON endpoints.
- `src/lib/services/` contains business logic for database mutations.
- `src/lib/db.js` creates the MySQL connection pool.
- `src/lib/parseWO.js` parses work-order Excel files.
- `src/lib/utils.js` contains shared formatting/date helpers.
- `db/schema.sql` is the base schema; `db/migrations/` contains incremental changes.
- `scripts/seed-skus.js` defines the active material SKU list.

Inventory balance is derived, not stored. The app calculates balances from `inventory_transactions` plus eligible purchase-order lines.

## Auth

Users log in at `/login` by selecting an active `app_users` record and entering its password. The app stores the selected user id in an `app_user_id` cookie and loads the active user in `src/hooks.server.js`.

Admins can access protected admin flows such as inventory counts and work-order import commits.

## Coding Conventions

- Use Svelte 5 runes (`$props`, `$state`, `$derived`, `$effect`).
- Keep `{#each}` blocks keyed.
- Use explicit `label for` and matching input `id`.
- Prefer component classes from `src/app.css` such as `.btn-primary`, `.form-input`, `.card`, and `.matrix-table`.
- Use services for transactional mutations. Routes should validate form input, call a service, and return `fail()` for user-facing action errors.
- All square-foot values are whole-number integers.
