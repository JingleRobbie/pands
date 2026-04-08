# PandS Inventory Tracker

Internal tool for tracking insulation material inventory, purchase orders, sales orders, and production runs.

## Stack

- **SvelteKit** (Svelte 5) — frontend + server-side rendering
- **MySQL** — database (append-only inventory ledger)
- **Tailwind CSS v3** — styling
- **Node.js** — production server via `@sveltejs/adapter-node`

## Setup

### Prerequisites

- Node.js 20+
- MySQL 8+

### First-time setup

1. **Clone and install**

    ```bash
    git clone https://github.com/<your-username>/pands.git
    cd pands
    npm install
    ```

2. **Create `.env`** (copy from `.env.example` and fill in your DB credentials)

    ```
    DB_HOST=localhost
    DB_PORT=3306
    DB_USER=your_user
    DB_PASSWORD=your_password
    DB_NAME=pands
    ```

3. **Initialize the database**

    ```bash
    mysql -u root -p < db/schema.sql
    npm run seed
    ```

4. **Compile CSS**
    ```bash
    npm run build:css
    ```

## Development

```bash
npm run dev        # Start dev server at http://localhost:5173
npm run watch:css  # Watch and recompile Tailwind in a separate terminal
```

## Available Scripts

| Script                 | Description                      |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start dev server with hot reload |
| `npm run build`        | Build for production             |
| `npm run build:css`    | Compile Tailwind CSS             |
| `npm run seed`         | Insert material SKUs into DB     |
| `npm run lint`         | Run ESLint                       |
| `npm run format`       | Format all files with Prettier   |
| `npm run format:check` | Check formatting without writing |
| `npm run test`         | Run unit tests                   |

## Production

```bash
npm run build
npm run build:css
node build/index.js   # Set PORT env var to change port (default 3000)
```

## Architecture

- `src/lib/services/` — all database mutations (inventory, purchasing, production)
- `src/routes/` — SvelteKit pages and API endpoints
- `db/schema.sql` — full database schema
- Inventory balance is never stored — always derived by summing `inventory_transactions`

## Auth

No passwords. Users select their name from a picker on first visit. The selection is stored as a cookie for the session.
