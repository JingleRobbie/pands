import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

// ── Balance helpers ──────────────────────────────────────────

export async function getAllBalances() {
	// Adjustments and consumptions from transactions (RECEIPT no longer used)
	const [txnRows] = await db.query(`
		SELECT sku_id,
			SUM(CASE WHEN transaction_type = 'ADJUSTMENT_IN'                       THEN sqft_quantity ELSE 0 END)
			- SUM(CASE WHEN transaction_type IN ('CONSUMPTION','ADJUSTMENT_OUT') THEN sqft_quantity ELSE 0 END)
			AS balance
		FROM inventory_transactions
		WHERE sku_id IN (SELECT id FROM material_skus WHERE is_active = TRUE)
		GROUP BY sku_id
	`);
	// Past PO lines count as received once expected_date <= today
	const [poRows] = await db.query(`
		SELECT pol.sku_id, SUM(pol.sqft_ordered) AS received
		FROM purchase_order_lines pol
		JOIN purchase_orders po ON po.id = pol.po_id
		WHERE (po.expected_date <= CURDATE() OR po.status = 'RECEIVED')
		  AND po.status != 'CANCELLED'
		  AND pol.status != 'CANCELLED'
		  AND pol.sku_id IN (SELECT id FROM material_skus WHERE is_active = TRUE)
		GROUP BY pol.sku_id
	`);
	const map = {};
	for (const r of txnRows) map[r.sku_id] = Number(r.balance) || 0;
	for (const r of poRows) map[r.sku_id] = (map[r.sku_id] ?? 0) + Number(r.received);
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
		       po.po_number, po.expected_date, po.status AS po_status, po.vendor_name
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
				partyName: line.vendor_name,
				description: `PO ${line.po_number}`,
				poNumber: line.po_number,
				soNumber: '',
				status: line.po_status,
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
		       wol.facing,
		       wo.so_number, wo.job_name, wo.id AS wo_id, wo.ship_date, wo.customer_name
		FROM production_runs pr
		JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		JOIN work_orders wo ON wo.id = wol.wo_id
		WHERE pr.run_date >= ? AND pr.status = 'SCHEDULED'
		ORDER BY pr.run_date, pr.run_number
	`,
		[today]
	);

	const prodRowMap = {};
	for (const run of prodRuns) {
		prodRowMap[run.id] = {
			rowType: 'production',
			partyName: run.customer_name,
			description: run.job_name,
			soNumber: run.so_number,
			poNumber: '',
			eventDate: run.run_date,
			shipDate: run.ship_date,
			facing: run.facing,
			runId: run.id,
			objectId: run.wo_id,
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

	// 8. Unscheduled WO lines
	const [unscheduledLines] = await db.query(`
		SELECT wol.id, wol.sku_id, wol.qty, wol.rolls_produced, wol.length_ft, wol.width_in, wol.facing,
		       wo.so_number, wo.job_name, wo.id AS wo_id, wo.customer_name, wo.ship_date,
		       COALESCE(
		         (SELECT SUM(pr.rolls_scheduled)
		          FROM production_runs pr
		          WHERE pr.wo_line_id = wol.id AND pr.status != 'COMPLETED'), 0
		       ) AS rolls_scheduled
		FROM work_order_lines wol
		JOIN work_orders wo ON wo.id = wol.wo_id
		WHERE wo.status NOT IN ('COMPLETE','CANCELLED')
		ORDER BY wo.ship_date, wo.so_number
	`);

	const unscheduledRows = [];
	for (const line of unscheduledLines) {
		const remainingRolls =
			Number(line.qty) - Number(line.rolls_produced) - Number(line.rolls_scheduled);
		if (remainingRolls <= 0) continue;

		const delta = -Math.round(
			remainingRolls * (Number(line.width_in) / 12) * Number(line.length_ft)
		);
		running[line.sku_id] = (running[line.sku_id] ?? 0) + delta;

		unscheduledRows.push({
			rowType: 'unscheduled',
			partyName: line.customer_name,
			description: line.job_name,
			soNumber: line.so_number,
			poNumber: '',
			eventDate: null,
			shipDate: line.ship_date,
			facing: line.facing,
			objectId: line.wo_id,
			woLineId: line.id,
			deltas: { [line.sku_id]: delta },
			cells: buildCells(skuIds, { [line.sku_id]: delta }, running),
		});
	}

	// 9. Historical activity rows (receipts + confirmed runs from past 2 days)
	const historyRows = await getHistoricalActivityRows(skuIds, subtractDays(today, 365));

	return { skus, balanceRow, historyRows, rows: [...datedRows, ...unscheduledRows] };
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
		       po.po_number, po.expected_date, po.status AS po_status, po.vendor_name
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
				partyName: line.vendor_name,
				description: `PO ${line.po_number}`,
				poNumber: line.po_number,
				soNumber: '',
				status: line.po_status,
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
		       wol.facing,
		       wo.so_number, wo.job_name, wo.id AS wo_id, wo.ship_date, wo.customer_name
		FROM production_runs pr
		JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		JOIN work_orders wo ON wo.id = wol.wo_id
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
			partyName: run.customer_name,
			description: run.job_name,
			soNumber: run.so_number,
			poNumber: '',
			eventDate: run.run_date,
			shipDate: run.ship_date,
			facing: run.facing,
			runId: run.id,
			objectId: run.wo_id,
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

	// 8. Unscheduled WO lines for these SKUs
	const [unscheduledLines] = await db.query(
		`
		SELECT wol.id, wol.sku_id, wol.qty, wol.rolls_produced, wol.length_ft, wol.width_in, wol.facing,
		       wo.so_number, wo.job_name, wo.id AS wo_id, wo.customer_name, wo.ship_date,
		       COALESCE(
		         (SELECT SUM(pr.rolls_scheduled)
		          FROM production_runs pr
		          WHERE pr.wo_line_id = wol.id AND pr.status != 'COMPLETED'), 0
		       ) AS rolls_scheduled
		FROM work_order_lines wol
		JOIN work_orders wo ON wo.id = wol.wo_id
		WHERE wo.status NOT IN ('COMPLETE','CANCELLED')
		  AND wol.sku_id IN (?)
		ORDER BY wo.ship_date, wo.so_number
	`,
		[skuIds]
	);

	const unscheduledRows = [];
	for (const line of unscheduledLines) {
		const remainingRolls =
			Number(line.qty) - Number(line.rolls_produced) - Number(line.rolls_scheduled);
		if (remainingRolls <= 0) continue;

		const delta = -Math.round(
			remainingRolls * (Number(line.width_in) / 12) * Number(line.length_ft)
		);
		running[line.sku_id] = (running[line.sku_id] ?? 0) + delta;

		unscheduledRows.push({
			rowType: 'unscheduled',
			partyName: line.customer_name,
			description: line.job_name,
			soNumber: line.so_number,
			poNumber: '',
			eventDate: null,
			shipDate: line.ship_date,
			facing: line.facing,
			objectId: line.wo_id,
			woLineId: line.id,
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

function subtractDays(dateStr, n) {
	const d = new Date(dateStr + 'T00:00:00');
	d.setDate(d.getDate() - n);
	return localDate(d);
}

export async function getCountBalancesAsOf(dateStr) {
	const [txnRows] = await db.query(
		`
		SELECT it.sku_id,
		  SUM(CASE WHEN it.transaction_type = 'ADJUSTMENT_IN'
		           AND DATE(it.created_at) <= ? THEN it.sqft_quantity ELSE 0 END)
		- SUM(CASE WHEN it.transaction_type = 'ADJUSTMENT_OUT'
		           AND DATE(it.created_at) <= ? THEN it.sqft_quantity ELSE 0 END)
		- SUM(CASE WHEN it.transaction_type = 'CONSUMPTION'
		           AND pr.run_date <= ? THEN it.sqft_quantity ELSE 0 END)
		AS balance
		FROM inventory_transactions it
		LEFT JOIN production_runs pr
		  ON it.reference_type = 'PRODUCTION_RUN' AND pr.id = it.reference_id
		WHERE it.sku_id IN (SELECT id FROM material_skus WHERE is_active = TRUE)
		GROUP BY it.sku_id
	`,
		[dateStr, dateStr, dateStr]
	);
	const [poRows] = await db.query(
		`
		SELECT pol.sku_id, SUM(pol.sqft_ordered) AS received
		FROM purchase_order_lines pol
		JOIN purchase_orders po ON po.id = pol.po_id
		WHERE (po.expected_date <= ? OR po.status = 'RECEIVED')
		  AND po.status != 'CANCELLED'
		  AND pol.status != 'CANCELLED'
		  AND pol.sku_id IN (SELECT id FROM material_skus WHERE is_active = TRUE)
		GROUP BY pol.sku_id
	`,
		[dateStr]
	);
	const map = {};
	for (const r of txnRows) map[r.sku_id] = Number(r.balance) || 0;
	for (const r of poRows) map[r.sku_id] = (map[r.sku_id] ?? 0) + Number(r.received);
	return map;
}

export async function createCountBatch(items, memo, countDate, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();
		const [result] = await conn.query(
			'INSERT INTO inventory_counts (memo, count_date, created_by) VALUES (?, ?, ?)',
			[memo, countDate, userId]
		);
		const countId = result.insertId;
		for (const { skuId, delta, newCount } of items) {
			const type = delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
			await conn.query(
				`INSERT INTO inventory_transactions
				   (sku_id, transaction_type, sqft_quantity, counted_sqft, reference_type, reference_id, created_by)
				 VALUES (?, ?, ?, ?, 'INVENTORY_COUNT', ?, ?)`,
				[skuId, type, Math.abs(delta), newCount ?? null, countId, userId]
			);
		}
		await conn.commit();
		return countId;
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

async function getHistoricalActivityRows(skuIds, fromDate) {
	// Past PO lines — expected_date has passed so they are auto-received
	const [poLines] = await db.query(
		`
		SELECT pol.sku_id, pol.sqft_ordered AS sqft_quantity,
		       LEAST(po.expected_date, CURDATE()) AS event_date,
		       po.id AS po_id, po.po_number, po.vendor_name
		FROM purchase_order_lines pol
		JOIN purchase_orders po ON po.id = pol.po_id
		WHERE (po.expected_date < CURDATE() OR po.status = 'RECEIVED')
		  AND po.expected_date >= ?
		  AND po.status != 'CANCELLED' AND pol.status != 'CANCELLED'
		ORDER BY event_date, po.po_number
	`,
		[fromDate]
	);

	const poRowMap = {};
	for (const t of poLines) {
		if (!poRowMap[t.po_id]) {
			poRowMap[t.po_id] = {
				rowType: 'historical',
				subType: 'po',
				partyName: t.vendor_name,
				description: `PO ${t.po_number}`,
				poNumber: t.po_number,
				soNumber: '',
				eventDate: t.event_date,
				shipDate: null,
				objectId: t.po_id,
				deltas: {},
			};
		}
		poRowMap[t.po_id].deltas[t.sku_id] =
			(poRowMap[t.po_id].deltas[t.sku_id] ?? 0) + Number(t.sqft_quantity);
	}

	// Confirmed production runs
	const [prodTxns] = await db.query(
		`
		SELECT it.sku_id, it.sqft_quantity, it.reference_id AS pr_id,
		       DATE(it.created_at) AS event_date,
		       wol.facing,
		       wo.so_number, wo.job_name, wo.id AS wo_id, wo.ship_date, wo.customer_name
		FROM inventory_transactions it
		JOIN production_runs pr ON pr.id = it.reference_id
		JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		JOIN work_orders wo ON wo.id = wol.wo_id
		WHERE it.reference_type = 'PRODUCTION_RUN' AND it.transaction_type = 'CONSUMPTION'
		  AND DATE(it.created_at) >= ?
		ORDER BY it.created_at
	`,
		[fromDate]
	);

	const prodRowMap = {};
	for (const t of prodTxns) {
		if (!prodRowMap[t.pr_id]) {
			prodRowMap[t.pr_id] = {
				rowType: 'historical',
				subType: 'production',
				partyName: t.customer_name,
				description: t.job_name,
				soNumber: t.so_number,
				poNumber: '',
				eventDate: t.event_date,
				shipDate: t.ship_date,
				facing: t.facing,
				objectId: t.wo_id,
				deltas: {},
			};
		}
		prodRowMap[t.pr_id].deltas[t.sku_id] =
			(prodRowMap[t.pr_id].deltas[t.sku_id] ?? 0) - Number(t.sqft_quantity);
	}

	// Inventory count adjustment rows
	const [adjTxns] = await db.query(
		`
		SELECT it.sku_id, it.sqft_quantity, it.transaction_type,
		       it.reference_id AS count_id,
		       ic.count_date AS event_date,
		       ic.memo
		FROM inventory_transactions it
		JOIN inventory_counts ic ON ic.id = it.reference_id
		WHERE it.reference_type = 'INVENTORY_COUNT'
		  AND ic.count_date >= ?
		ORDER BY it.created_at
	`,
		[fromDate]
	);

	const adjRowMap = {};
	for (const t of adjTxns) {
		if (!adjRowMap[t.count_id]) {
			adjRowMap[t.count_id] = {
				rowType: 'historical',
				subType: 'adjustment',
				description: t.memo || 'Inventory Adjustment',
				partyName: '',
				poNumber: '',
				soNumber: '',
				eventDate: t.event_date,
				shipDate: null,
				objectId: t.count_id,
				deltas: {},
			};
		}
		const sign = t.transaction_type === 'ADJUSTMENT_IN' ? 1 : -1;
		adjRowMap[t.count_id].deltas[t.sku_id] =
			(adjRowMap[t.count_id].deltas[t.sku_id] ?? 0) + sign * Number(t.sqft_quantity);
	}

	// Sort by date: POs first, adjustments second, production runs third
	const typeOrder = { po: 0, adjustment: 1, production: 2 };
	const rows = [
		...Object.values(poRowMap),
		...Object.values(adjRowMap),
		...Object.values(prodRowMap),
	].sort((a, b) => {
		if (a.eventDate < b.eventDate) return -1;
		if (a.eventDate > b.eventDate) return 1;
		return (typeOrder[a.subType] ?? 2) - (typeOrder[b.subType] ?? 2);
	});

	// Baseline: balance before the history window
	const baseline = await getBalancesAsOf(skuIds, subtractDays(fromDate, 1));
	const running = {};
	for (const id of skuIds) running[id] = baseline[id] ?? 0;

	// Build cells with running totals — same pattern as future dated rows
	for (const row of rows) {
		for (const id of skuIds) {
			if (row.deltas[id] != null) running[id] += row.deltas[id];
		}
		row.cells = buildCells(skuIds, row.deltas, running);
		delete row.deltas;
	}

	return rows;
}

async function getBalancesAsOf(skuIds, dateStr) {
	const [txnRows] = await db.query(
		`
		SELECT sku_id,
			SUM(CASE WHEN transaction_type = 'ADJUSTMENT_IN'                       THEN sqft_quantity ELSE 0 END)
			- SUM(CASE WHEN transaction_type IN ('CONSUMPTION','ADJUSTMENT_OUT') THEN sqft_quantity ELSE 0 END)
			AS balance
		FROM inventory_transactions
		WHERE sku_id IN (?) AND DATE(created_at) <= ?
		GROUP BY sku_id
	`,
		[skuIds, dateStr]
	);
	const [poRows] = await db.query(
		`
		SELECT pol.sku_id, SUM(pol.sqft_ordered) AS received
		FROM purchase_order_lines pol
		JOIN purchase_orders po ON po.id = pol.po_id
		WHERE po.expected_date <= ?
		  AND po.status != 'CANCELLED'
		  AND pol.status != 'CANCELLED'
		  AND pol.sku_id IN (?)
		GROUP BY pol.sku_id
	`,
		[dateStr, skuIds]
	);
	const map = {};
	for (const r of txnRows) map[r.sku_id] = Number(r.balance) || 0;
	for (const r of poRows) map[r.sku_id] = (map[r.sku_id] ?? 0) + Number(r.received);
	return map;
}
