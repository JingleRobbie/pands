import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

function transactionDelta(alias = 'it') {
	return `CASE
		WHEN ${alias}.transaction_type IN ('RECEIPT','CONSUMPTION_REVERSAL','ADJUSTMENT_IN') THEN ${alias}.sqft_quantity
		WHEN ${alias}.transaction_type IN ('RECEIPT_REVERSAL','CONSUMPTION','ADJUSTMENT_OUT') THEN -${alias}.sqft_quantity
		ELSE 0
	END`;
}

function transactionEventDate(alias = 'it') {
	return `${alias}.effective_date`;
}

export async function getAllBalances() {
	const [rows] = await db.query(`
		SELECT sku_id,
			SUM(${transactionDelta('it')}) AS balance
		FROM inventory_transactions it
		WHERE sku_id IN (SELECT id FROM material_skus WHERE is_active = TRUE)
		GROUP BY sku_id
	`);
	return rowsToBalanceMap(rows);
}

export async function getMatrixData(fromDate = null) {
	const today = fromDate ?? localDate();
	return buildMatrixData({ today, includeHistory: true });
}

export async function getMatrixDataForSkus(skuIds) {
	return buildMatrixData({ today: localDate(), skuIds });
}

async function buildMatrixData({ today, skuIds = null, includeHistory = false }) {
	const skus = await getMatrixSkus(skuIds);
	const matrixSkuIds = skus.map((s) => s.id);

	const balanceMap = await getAllBalances();
	const running = buildRunningMap(matrixSkuIds, balanceMap);
	const balanceRow = {
		rowType: 'balance',
		description: 'Current Inventory',
		cells: buildCells(matrixSkuIds, {}, running),
	};

	const filterBySku = Array.isArray(skuIds);
	const poRowMap = buildPoRowMap(await getUpcomingPoLines(today, matrixSkuIds, filterBySku));
	const prodRowMap = buildProductionRowMap(
		await getScheduledProductionRuns(today, matrixSkuIds, filterBySku)
	);

	const datedRows = sortDatedRows(poRowMap, prodRowMap);
	applyRunningCells(datedRows, matrixSkuIds, running);

	const unscheduledRows = buildUnscheduledRows(
		await getUnscheduledLines(matrixSkuIds, filterBySku),
		matrixSkuIds,
		running
	);

	const rows = [...datedRows, ...unscheduledRows];
	if (!includeHistory) return { skus, balanceRow, rows };

	const historyRows = await getHistoricalActivityRows(matrixSkuIds, subtractDays(today, 365));
	return { skus, balanceRow, historyRows, rows };
}

async function getMatrixSkus(skuIds) {
	if (Array.isArray(skuIds)) {
		if (skuIds.length === 0) return [];
		const [skus] = await db.query(
			'SELECT * FROM material_skus WHERE id IN (?) ORDER BY sort_order, thickness_in, width_in',
			[skuIds]
		);
		return skus;
	}

	const [skus] = await db.query(
		'SELECT * FROM material_skus WHERE is_active = TRUE ORDER BY sort_order, thickness_in, width_in'
	);
	return skus;
}

async function getUpcomingPoLines(today, skuIds, filterBySku) {
	if (filterBySku && skuIds.length === 0) return [];
	const skuWhere = filterBySku ? 'AND pol.sku_id IN (?)' : '';
	const params = filterBySku ? [today, skuIds] : [today];

	const [poLines] = await db.query(
		`
		SELECT pol.id, pol.po_id, pol.sku_id, pol.sqft_ordered,
		       po.po_number, po.expected_date, po.status AS po_status, po.vendor_name
		FROM purchase_order_lines pol
		JOIN purchase_orders po ON po.id = pol.po_id
		WHERE po.expected_date >= ? AND po.status = 'OPEN' AND pol.status = 'OPEN'
		  ${skuWhere}
		ORDER BY po.expected_date, po.po_number
	`,
		params
	);
	return poLines;
}

async function getScheduledProductionRuns(today, skuIds, filterBySku) {
	if (filterBySku && skuIds.length === 0) return [];
	const skuWhere = filterBySku ? 'AND pr.sku_id IN (?)' : '';
	const params = filterBySku ? [today, skuIds] : [today];

	const [prodRuns] = await db.query(
		`
		SELECT pr.id, pr.group_id, pr.sku_id, pr.run_date, pr.sqft_scheduled,
		       wol.facing,
		       wo.so_number, wo.job_name, wo.id AS wo_id, wo.ship_date, wo.customer_name
		FROM production_runs pr
		JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		JOIN work_orders wo ON wo.id = wol.wo_id
		WHERE pr.run_date >= ? AND pr.status = 'SCHEDULED'
		  ${skuWhere}
		ORDER BY pr.run_date, pr.run_number
	`,
		params
	);
	return prodRuns;
}

async function getUnscheduledLines(skuIds, filterBySku) {
	if (filterBySku && skuIds.length === 0) return [];
	const skuWhere = filterBySku ? 'AND wol.sku_id IN (?)' : '';
	const params = filterBySku ? [skuIds] : [];

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
		  ${skuWhere}
		ORDER BY wo.ship_date, wo.so_number
	`,
		params
	);
	return unscheduledLines;
}

function buildPoRowMap(poLines) {
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
	return poRowMap;
}

function buildProductionRowMap(prodRuns) {
	const prodRowMap = {};
	for (const run of prodRuns) {
		const key = run.group_id ?? run.id;
		if (!prodRowMap[key]) {
			prodRowMap[key] = {
				rowType: 'production',
				partyName: run.customer_name,
				description: run.job_name,
				soNumber: run.so_number,
				poNumber: '',
				eventDate: run.run_date,
				shipDate: run.ship_date,
				facings: new Set(),
				groupId: key,
				objectId: run.wo_id,
				deltas: {},
			};
		}
		prodRowMap[key].deltas[run.sku_id] =
			(prodRowMap[key].deltas[run.sku_id] ?? 0) - Number(run.sqft_scheduled);
		if (run.facing) prodRowMap[key].facings.add(run.facing);
	}
	for (const row of Object.values(prodRowMap)) {
		row.facing = [...row.facings].join(', ');
		delete row.facings;
	}
	return prodRowMap;
}

function sortDatedRows(poRowMap, prodRowMap) {
	const allDates = [
		...new Set([
			...Object.values(poRowMap).map((r) => fmtDate(r.eventDate)),
			...Object.values(prodRowMap).map((r) => fmtDate(r.eventDate)),
		]),
	].sort();

	const datedRows = [];
	for (const d of allDates) {
		for (const row of Object.values(poRowMap)) {
			if (fmtDate(row.eventDate) === d) datedRows.push(row);
		}
		for (const row of Object.values(prodRowMap)) {
			if (fmtDate(row.eventDate) === d) datedRows.push(row);
		}
	}
	return datedRows;
}

function buildUnscheduledRows(unscheduledLines, skuIds, running) {
	const unscheduledRows = [];
	for (const line of unscheduledLines) {
		const remainingRolls =
			Number(line.qty) - Number(line.rolls_produced) - Number(line.rolls_scheduled);
		if (remainingRolls <= 0) continue;

		const delta = -calcSqft(line, remainingRolls);
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
	return unscheduledRows;
}

function applyRunningCells(rows, skuIds, running) {
	for (const row of rows) {
		for (const id of skuIds) {
			if (row.deltas[id] != null) running[id] += row.deltas[id];
		}
		row.cells = buildCells(skuIds, row.deltas, running);
	}
}

function buildRunningMap(skuIds, balanceMap) {
	const running = {};
	for (const id of skuIds) running[id] = balanceMap[id] ?? 0;
	return running;
}

function rowsToBalanceMap(rows) {
	const map = {};
	for (const r of rows) map[r.sku_id] = Number(r.balance) || 0;
	return map;
}

function calcSqft(line, rolls) {
	return Math.round(Number(rolls) * (Number(line.width_in) / 12) * Number(line.length_ft));
}

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
	const [rows] = await db.query(
		`
		SELECT it.sku_id,
		  SUM(${transactionDelta('it')}) AS balance
		FROM inventory_transactions it
		WHERE it.sku_id IN (SELECT id FROM material_skus WHERE is_active = TRUE)
		  AND ${transactionEventDate('it')} <= ?
		GROUP BY it.sku_id
	`,
		[dateStr]
	);
	return rowsToBalanceMap(rows);
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
				   (sku_id, transaction_type, sqft_quantity, counted_sqft, effective_date, reference_type, reference_id, created_by)
				 VALUES (?, ?, ?, ?, ?, 'INVENTORY_COUNT', ?, ?)`,
				[skuId, type, Math.abs(delta), newCount ?? null, countDate, countId, userId]
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
	const [receiptTxns] = await db.query(
		`
		SELECT it.sku_id, it.sqft_quantity, it.transaction_type,
		       it.effective_date AS event_date,
		       pol.po_id, po.po_number, po.vendor_name
		FROM inventory_transactions it
		JOIN purchase_order_lines pol ON pol.id = it.reference_id
		JOIN purchase_orders po ON po.id = pol.po_id
		WHERE it.reference_type = 'PO_LINE'
		  AND it.transaction_type IN ('RECEIPT','RECEIPT_REVERSAL')
		  AND it.effective_date >= ?
		ORDER BY it.effective_date, it.created_at, po.po_number
	`,
		[fromDate]
	);

	const poRowMap = {};
	for (const t of receiptTxns) {
		const key = `${t.po_id}:${t.event_date}:${t.transaction_type}`;
		if (!poRowMap[key]) {
			const isReversal = t.transaction_type === 'RECEIPT_REVERSAL';
			poRowMap[key] = {
				rowType: 'historical',
				subType: 'po',
				partyName: t.vendor_name,
				description: isReversal ? `PO ${t.po_number} Unreceived` : `PO ${t.po_number}`,
				activityLabel: isReversal ? 'UNRECEIVED' : 'RECEIVED',
				activityClass: isReversal ? 'badge-amber' : 'badge-green',
				poNumber: t.po_number,
				soNumber: '',
				eventDate: t.event_date,
				shipDate: null,
				objectId: t.po_id,
				deltas: {},
			};
		}
		const sign = t.transaction_type === 'RECEIPT' ? 1 : -1;
		poRowMap[key].deltas[t.sku_id] =
			(poRowMap[key].deltas[t.sku_id] ?? 0) + sign * Number(t.sqft_quantity);
	}

	const [prodTxns] = await db.query(
		`
		SELECT it.sku_id, it.sqft_quantity, it.reference_id AS pr_id,
		       pr.group_id,
		       it.effective_date AS event_date,
		       wol.facing,
		       wo.so_number, wo.job_name, wo.id AS wo_id, wo.ship_date, wo.customer_name
		FROM inventory_transactions it
		JOIN production_runs pr ON pr.id = it.reference_id
		JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		JOIN work_orders wo ON wo.id = wol.wo_id
		WHERE it.reference_type = 'PRODUCTION_RUN'
		  AND it.transaction_type IN ('CONSUMPTION','CONSUMPTION_REVERSAL')
		  AND it.effective_date >= ?
		ORDER BY it.effective_date, it.created_at
	`,
		[fromDate]
	);

	const prodRowMap = {};
	for (const t of prodTxns) {
		const key = `${t.group_id ?? t.pr_id}:${t.event_date}:${t.transaction_type}`;
		if (!prodRowMap[key]) {
			const isReversal = t.transaction_type === 'CONSUMPTION_REVERSAL';
			prodRowMap[key] = {
				rowType: 'historical',
				subType: 'production',
				partyName: t.customer_name,
				description: isReversal ? `${t.job_name} Unproduced` : t.job_name,
				activityLabel: isReversal ? 'UNPRODUCED' : null,
				activityClass: isReversal ? 'badge-amber' : null,
				soNumber: t.so_number,
				poNumber: '',
				eventDate: t.event_date,
				shipDate: t.ship_date,
				facings: new Set(),
				objectId: t.wo_id,
				deltas: {},
			};
		}
		const sign = t.transaction_type === 'CONSUMPTION_REVERSAL' ? 1 : -1;
		prodRowMap[key].deltas[t.sku_id] =
			(prodRowMap[key].deltas[t.sku_id] ?? 0) + sign * Number(t.sqft_quantity);
		if (t.facing) prodRowMap[key].facings.add(t.facing);
	}
	for (const row of Object.values(prodRowMap)) {
		row.facing = [...row.facings].join(', ');
		delete row.facings;
	}

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

	const typeOrder = { adjustment: 0, po: 1, production: 2 };
	const rows = [
		...Object.values(poRowMap),
		...Object.values(adjRowMap),
		...Object.values(prodRowMap),
	].sort((a, b) => {
		if (a.eventDate < b.eventDate) return -1;
		if (a.eventDate > b.eventDate) return 1;
		return (typeOrder[a.subType] ?? 2) - (typeOrder[b.subType] ?? 2);
	});

	const baseline = await getBalancesAsOf(skuIds, subtractDays(fromDate, 1));
	const running = buildRunningMap(skuIds, baseline);

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
	if (!skuIds.length) return {};
	const [rows] = await db.query(
		`
		SELECT it.sku_id,
			SUM(${transactionDelta('it')}) AS balance
		FROM inventory_transactions it
		WHERE it.sku_id IN (?) AND ${transactionEventDate('it')} <= ?
		GROUP BY it.sku_id
	`,
		[skuIds, dateStr]
	);
	return rowsToBalanceMap(rows);
}

export const __inventoryTest = {
	buildCells,
	buildRunningMap,
	buildUnscheduledRows,
	calcSqft,
	rowsToBalanceMap,
};
