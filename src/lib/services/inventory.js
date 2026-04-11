import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

const IN_TYPES = ['RECEIPT', 'ADJUSTMENT_IN'];
const OUT_TYPES = ['CONSUMPTION', 'ADJUSTMENT_OUT'];

// ── Balance helpers ──────────────────────────────────────────

export async function getAllBalances() {
	const [rows] = await db.query(`
		SELECT
			sku_id,
			SUM(CASE WHEN transaction_type IN ('RECEIPT','ADJUSTMENT_IN')    THEN sqft_quantity ELSE 0 END)
			- SUM(CASE WHEN transaction_type IN ('CONSUMPTION','ADJUSTMENT_OUT') THEN sqft_quantity ELSE 0 END)
			AS balance
		FROM inventory_transactions
		WHERE sku_id IN (SELECT id FROM material_skus WHERE is_active = TRUE)
		GROUP BY sku_id
	`);
	const map = {};
	for (const r of rows) map[r.sku_id] = Number(r.balance) || 0;
	return map;
}

// ── Matrix data ──────────────────────────────────────────────

export async function getMatrixData(fromDate = null) {
	const today = fromDate ?? localDate();

	// 1. All active SKUs
	const [skus] = await db.query(
		'SELECT * FROM material_skus WHERE is_active = TRUE ORDER BY sort_order, thickness_in, width_in'
	);
	const skuIds = skus.map((s) => s.id);

	// 2. Current on-hand balances (starting point for running totals)
	const balanceMap = await getAllBalances();
	const running = {};
	for (const id of skuIds) running[id] = balanceMap[id] ?? 0;

	// 3. Balance row (current inventory header)
	const balanceRow = {
		rowType: 'balance',
		description: 'Current Inventory',
		cells: buildCells(skuIds, {}, running),
	};

	// 4. Upcoming PO lines (grouped by PO)
	const [poLines] = await db.query(
		`
		SELECT pol.id, pol.po_id, pol.sku_id, pol.sqft_ordered,
		       po.po_number, po.expected_date, po.status AS po_status
		FROM purchase_order_lines pol
		JOIN purchase_orders po ON po.id = pol.po_id
		WHERE po.expected_date >= ? AND po.status = 'OPEN' AND pol.status = 'OPEN'
		ORDER BY po.expected_date, po.po_number
	`,
		[today]
	);

	const poRowMap = {};
	for (const line of poLines) {
		if (!poRowMap[line.po_id]) {
			poRowMap[line.po_id] = {
				rowType: 'po',
				description: `PO ${line.po_number}`,
				poNumber: line.po_number,
				soNumber: '',
				eventDate: line.expected_date,
				shipDate: null,
				objectId: line.po_id,
				deltas: {},
			};
		}
		const row = poRowMap[line.po_id];
		row.deltas[line.sku_id] = (row.deltas[line.sku_id] ?? 0) + Number(line.sqft_ordered);
	}

	// 5. Scheduled production runs
	const [prodRuns] = await db.query(
		`
		SELECT pr.id, pr.sku_id, pr.run_date, pr.sqft_scheduled,
		       so.so_number, so.job_name, so.id AS so_id, so.ship_date
		FROM production_runs pr
		JOIN sales_order_lines sol ON sol.id = pr.so_line_id
		JOIN sales_orders so ON so.id = sol.so_id
		WHERE pr.run_date >= ? AND pr.status = 'SCHEDULED'
		ORDER BY pr.run_date, pr.run_number
	`,
		[today]
	);

	const prodRowMap = {};
	for (const run of prodRuns) {
		prodRowMap[run.id] = {
			rowType: 'production',
			description: run.job_name,
			soNumber: run.so_number,
			poNumber: '',
			eventDate: run.run_date,
			shipDate: run.ship_date,
			objectId: run.id,
			deltas: { [run.sku_id]: -Number(run.sqft_scheduled) },
		};
	}

	// 6. Sort dated rows: same date → POs before production runs
	const allDates = [
		...new Set([
			...Object.values(poRowMap).map((r) => fmtDate(r.eventDate)),
			...Object.values(prodRowMap).map((r) => fmtDate(r.eventDate)),
		]),
	].sort();

	const datedRows = [];
	for (const d of allDates) {
		for (const row of Object.values(poRowMap))
			if (fmtDate(row.eventDate) === d) datedRows.push(row);
		for (const row of Object.values(prodRowMap))
			if (fmtDate(row.eventDate) === d) datedRows.push(row);
	}

	// 7. Compute running totals for dated rows
	for (const row of datedRows) {
		for (const id of skuIds) {
			if (row.deltas[id] != null) running[id] += row.deltas[id];
		}
		row.cells = buildCells(skuIds, row.deltas, running);
	}

	// 8. Unscheduled SO lines
	const [unscheduledLines] = await db.query(`
		SELECT sol.id, sol.sku_id, sol.sqft_ordered, sol.sqft_produced,
		       so.so_number, so.job_name, so.id AS so_id,
		       COALESCE(
		         (SELECT SUM(pr.sqft_scheduled)
		          FROM production_runs pr
		          WHERE pr.so_line_id = sol.id AND pr.status != 'CONFIRMED'), 0
		       ) AS sqft_scheduled
		FROM sales_order_lines sol
		JOIN sales_orders so ON so.id = sol.so_id
		WHERE so.status IN ('OPEN','IN_PROGRESS')
		ORDER BY so.ship_date, so.so_number
	`);

	const unscheduledRows = [];
	for (const line of unscheduledLines) {
		const unscheduled =
			Number(line.sqft_ordered) - Number(line.sqft_produced) - Number(line.sqft_scheduled);
		if (unscheduled <= 0) continue;

		const delta = -unscheduled;
		running[line.sku_id] = (running[line.sku_id] ?? 0) + delta;

		unscheduledRows.push({
			rowType: 'unscheduled',
			description: line.job_name,
			soNumber: line.so_number,
			poNumber: '',
			eventDate: null,
			shipDate: line.ship_date,
			objectId: line.so_id,
			deltas: { [line.sku_id]: delta },
			cells: buildCells(skuIds, { [line.sku_id]: delta }, running),
		});
	}

	return { skus, balanceRow, rows: [...datedRows, ...unscheduledRows] };
}

// ── SKU-filtered matrix (for entity detail pages) ────────────

export async function getMatrixDataForSkus(skuIds) {
	const today = localDate();

	// 1. Only the requested SKUs
	const [skus] = await db.query(
		'SELECT * FROM material_skus WHERE id IN (?) ORDER BY sort_order, thickness_in, width_in',
		[skuIds]
	);

	// 2. Current balances, filtered to these SKUs
	const allBalances = await getAllBalances();
	const running = {};
	for (const id of skuIds) running[id] = allBalances[id] ?? 0;

	// 3. Balance row
	const balanceRow = {
		rowType: 'balance',
		description: 'Current Inventory',
		cells: buildCells(skuIds, {}, running),
	};

	// 4. Upcoming PO lines for these SKUs
	const [poLines] = await db.query(
		`
		SELECT pol.id, pol.po_id, pol.sku_id, pol.sqft_ordered,
		       po.po_number, po.expected_date
		FROM purchase_order_lines pol
		JOIN purchase_orders po ON po.id = pol.po_id
		WHERE po.expected_date >= ? AND po.status = 'OPEN' AND pol.status = 'OPEN'
		  AND pol.sku_id IN (?)
		ORDER BY po.expected_date, po.po_number
	`,
		[today, skuIds]
	);

	const poRowMap = {};
	for (const line of poLines) {
		if (!poRowMap[line.po_id]) {
			poRowMap[line.po_id] = {
				rowType: 'po',
				description: `PO ${line.po_number}`,
				poNumber: line.po_number,
				soNumber: '',
				eventDate: line.expected_date,
				shipDate: null,
				objectId: line.po_id,
				deltas: {},
			};
		}
		const row = poRowMap[line.po_id];
		row.deltas[line.sku_id] = (row.deltas[line.sku_id] ?? 0) + Number(line.sqft_ordered);
	}

	// 5. Scheduled production runs for these SKUs
	const [prodRuns] = await db.query(
		`
		SELECT pr.id, pr.sku_id, pr.run_date, pr.sqft_scheduled,
		       so.so_number, so.job_name, so.id AS so_id, so.ship_date
		FROM production_runs pr
		JOIN sales_order_lines sol ON sol.id = pr.so_line_id
		JOIN sales_orders so ON so.id = sol.so_id
		WHERE pr.run_date >= ? AND pr.status = 'SCHEDULED'
		  AND pr.sku_id IN (?)
		ORDER BY pr.run_date, pr.run_number
	`,
		[today, skuIds]
	);

	const prodRowMap = {};
	for (const run of prodRuns) {
		prodRowMap[run.id] = {
			rowType: 'production',
			description: run.job_name,
			soNumber: run.so_number,
			poNumber: '',
			eventDate: run.run_date,
			shipDate: run.ship_date,
			objectId: run.id,
			deltas: { [run.sku_id]: -Number(run.sqft_scheduled) },
		};
	}

	// 6. Sort dated rows: same date → POs before production runs
	const allDates = [
		...new Set([
			...Object.values(poRowMap).map((r) => fmtDate(r.eventDate)),
			...Object.values(prodRowMap).map((r) => fmtDate(r.eventDate)),
		]),
	].sort();

	const datedRows = [];
	for (const d of allDates) {
		for (const row of Object.values(poRowMap))
			if (fmtDate(row.eventDate) === d) datedRows.push(row);
		for (const row of Object.values(prodRowMap))
			if (fmtDate(row.eventDate) === d) datedRows.push(row);
	}

	// 7. Running totals for dated rows
	for (const row of datedRows) {
		for (const id of skuIds) {
			if (row.deltas[id] != null) running[id] += row.deltas[id];
		}
		row.cells = buildCells(skuIds, row.deltas, running);
	}

	// 8. Unscheduled SO lines for these SKUs
	const [unscheduledLines] = await db.query(
		`
		SELECT sol.id, sol.sku_id, sol.sqft_ordered, sol.sqft_produced,
		       so.so_number, so.job_name, so.id AS so_id,
		       COALESCE(
		         (SELECT SUM(pr.sqft_scheduled)
		          FROM production_runs pr
		          WHERE pr.so_line_id = sol.id AND pr.status != 'CONFIRMED'), 0
		       ) AS sqft_scheduled
		FROM sales_order_lines sol
		JOIN sales_orders so ON so.id = sol.so_id
		WHERE so.status IN ('OPEN','IN_PROGRESS')
		  AND sol.sku_id IN (?)
		ORDER BY so.ship_date, so.so_number
	`,
		[skuIds]
	);

	const unscheduledRows = [];
	for (const line of unscheduledLines) {
		const unscheduled =
			Number(line.sqft_ordered) - Number(line.sqft_produced) - Number(line.sqft_scheduled);
		if (unscheduled <= 0) continue;

		const delta = -unscheduled;
		running[line.sku_id] = (running[line.sku_id] ?? 0) + delta;

		unscheduledRows.push({
			rowType: 'unscheduled',
			description: line.job_name,
			soNumber: line.so_number,
			poNumber: '',
			eventDate: null,
			shipDate: line.ship_date,
			objectId: line.so_id,
			deltas: { [line.sku_id]: delta },
			cells: buildCells(skuIds, { [line.sku_id]: delta }, running),
		});
	}

	return { skus, balanceRow, rows: [...datedRows, ...unscheduledRows] };
}

// ── Helpers ───────────────────────────────────────────────────

function buildCells(skuIds, deltas, running) {
	const cells = {};
	for (const id of skuIds) {
		cells[id] = {
			delta: deltas[id] ?? null,
			runningTotal: running[id] ?? 0,
		};
	}
	return cells;
}

function fmtDate(d) {
	if (!d) return '';
	if (typeof d === 'string') return d.slice(0, 10);
	return d.toISOString().slice(0, 10);
}
