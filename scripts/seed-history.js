/**
 * Seed 10 days of historical PO receipts and confirmed production runs.
 * Safe to re-run — skips records that already exist.
 *
 * Usage: node scripts/seed-history.js
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const db = await mysql.createConnection({
	host: process.env.DB_HOST || 'localhost',
	port: Number(process.env.DB_PORT) || 3306,
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || '',
	database: process.env.DB_NAME || 'pands',
	decimalNumbers: true,
});

// ── SKU lookup ────────────────────────────────────────────────
const [skuRows] = await db.query('SELECT id, sku_code FROM material_skus WHERE is_active = TRUE');
const skuByCode = Object.fromEntries(skuRows.map((s) => [s.sku_code, s.id]));
function sid(code) {
	const id = skuByCode[code];
	if (!id) throw new Error(`SKU not found: ${code}`);
	return id;
}

// ── Purchase orders received over the past 10 days ────────────
// Each entry: one PO received on a specific day with multiple lines
const RECEIVED_POS = [
	{
		po_number: 'HIST-PO-001',
		vendor_name: 'JM',
		expected_date: '2026-04-02',
		received_at: '2026-04-02 08:45:00',
		lines: [
			{ sku_code: '3048', sqft: 2400 },
			{ sku_code: '3072', sqft: 1800 },
		],
	},
	{
		po_number: 'HIST-PO-002',
		vendor_name: 'Certainteed',
		expected_date: '2026-04-04',
		received_at: '2026-04-04 10:20:00',
		lines: [
			{ sku_code: '4048', sqft: 3200 },
			{ sku_code: '4060', sqft: 2800 },
			{ sku_code: '4072', sqft: 1600 },
		],
	},
	{
		po_number: 'HIST-PO-003',
		vendor_name: 'JM',
		expected_date: '2026-04-06',
		received_at: '2026-04-06 13:10:00',
		lines: [
			{ sku_code: '6048', sqft: 2000 },
			{ sku_code: '6072', sqft: 2400 },
		],
	},
	{
		po_number: 'HIST-PO-004',
		vendor_name: 'Certainteed',
		expected_date: '2026-04-08',
		received_at: '2026-04-08 09:00:00',
		lines: [
			{ sku_code: '3036', sqft: 3600 },
			{ sku_code: '3048', sqft: 1200 },
		],
	},
	{
		po_number: 'HIST-PO-005',
		vendor_name: 'JM',
		expected_date: '2026-04-10',
		received_at: '2026-04-10 11:30:00',
		lines: [
			{ sku_code: '8048', sqft: 1400 },
			{ sku_code: '8060', sqft: 1000 },
			{ sku_code: '9548', sqft: 800 },
		],
	},
];

console.log('\n── Purchase Order Receipts ──────────────────────────');
for (const po of RECEIVED_POS) {
	await db.query(
		`INSERT IGNORE INTO purchase_orders (po_number, vendor_name, expected_date, status, created_at)
		 VALUES (?, ?, ?, 'RECEIVED', ?)`,
		[po.po_number, po.vendor_name, po.expected_date, po.received_at]
	);

	const [[{ id: poId }]] = await db.query('SELECT id FROM purchase_orders WHERE po_number = ?', [
		po.po_number,
	]);

	for (const line of po.lines) {
		const skuId = sid(line.sku_code);

		const [[existing]] = await db.query(
			'SELECT id FROM purchase_order_lines WHERE po_id = ? AND sku_id = ?',
			[poId, skuId]
		);
		if (existing) {
			console.log(`  skipped (exists): ${po.po_number} / ${line.sku_code}`);
			continue;
		}

		const [lineResult] = await db.query(
			`INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered, sqft_received, status)
			 VALUES (?, ?, ?, ?, 'RECEIVED')`,
			[poId, skuId, line.sqft, line.sqft]
		);
		const lineId = lineResult.insertId;

		const [[txExists]] = await db.query(
			'SELECT id FROM inventory_transactions WHERE reference_type = ? AND reference_id = ?',
			['PO_LINE', lineId]
		);
		if (!txExists) {
			await db.query(
				`INSERT INTO inventory_transactions
				 (sku_id, transaction_type, sqft_quantity, reference_type, reference_id, memo, created_at)
				 VALUES (?, 'RECEIPT', ?, 'PO_LINE', ?, ?, ?)`,
				[skuId, line.sqft, lineId, `Received ${po.po_number}`, po.received_at]
			);
		}
		console.log(
			`  ✓ RECEIPT  ${po.vendor_name.padEnd(12)} ${po.po_number}  ${line.sku_code}  ${line.sqft.toLocaleString()} sqft  [${po.received_at.slice(0, 10)}]`
		);
	}
}

// ── Sales orders + confirmed production runs ───────────────────
// Each SO groups related runs. Runs on different days = activity spread across history.
const CONFIRMED_SOS = [
	{
		so_number: 'HIST-SO-001',
		customer_name: 'Riverside Mechanical',
		job_name: 'Riverside Apartments Ph.1',
		ship_date: '2026-04-10',
		runs: [
			{
				run_number: 'HIST-RUN-001',
				sku_code: '3048',
				sqft: 1200,
				confirmed_at: '2026-04-01 14:00:00',
			},
			{
				run_number: 'HIST-RUN-002',
				sku_code: '3072',
				sqft: 900,
				confirmed_at: '2026-04-03 10:30:00',
			},
		],
	},
	{
		so_number: 'HIST-SO-002',
		customer_name: 'Metro Construction',
		job_name: 'Downtown Office Retrofit',
		ship_date: '2026-04-14',
		runs: [
			{
				run_number: 'HIST-RUN-003',
				sku_code: '4048',
				sqft: 2100,
				confirmed_at: '2026-04-05 09:15:00',
			},
			{
				run_number: 'HIST-RUN-004',
				sku_code: '4060',
				sqft: 1800,
				confirmed_at: '2026-04-07 16:00:00',
			},
		],
	},
	{
		so_number: 'HIST-SO-003',
		customer_name: 'City Insulation Co.',
		job_name: 'Westpark Industrial Bldg B',
		ship_date: '2026-04-09',
		runs: [
			{
				run_number: 'HIST-RUN-005',
				sku_code: '6072',
				sqft: 960,
				confirmed_at: '2026-04-06 11:45:00',
			},
			{
				run_number: 'HIST-RUN-006',
				sku_code: '6048',
				sqft: 720,
				confirmed_at: '2026-04-08 14:30:00',
			},
		],
	},
	{
		so_number: 'HIST-SO-004',
		customer_name: 'Apex Contractors',
		job_name: 'Northgate Warehouse',
		ship_date: '2026-04-12',
		runs: [
			{
				run_number: 'HIST-RUN-007',
				sku_code: '8048',
				sqft: 1400,
				confirmed_at: '2026-04-09 08:00:00',
			},
		],
	},
	{
		so_number: 'HIST-SO-005',
		customer_name: 'Riverside Mechanical',
		job_name: 'Riverside Apartments Ph.2',
		ship_date: '2026-04-16',
		runs: [
			{
				run_number: 'HIST-RUN-008',
				sku_code: '3048',
				sqft: 1500,
				confirmed_at: '2026-04-10 13:00:00',
			},
		],
	},
];

console.log('\n── Confirmed Production Runs ────────────────────────');
for (const so of CONFIRMED_SOS) {
	await db.query(
		`INSERT IGNORE INTO sales_orders (so_number, customer_name, job_name, ship_date, status, created_at)
		 VALUES (?, ?, ?, ?, 'COMPLETE', ?)`,
		[so.so_number, so.customer_name, so.job_name, so.ship_date, so.runs[0].confirmed_at]
	);

	const [[{ id: soId }]] = await db.query('SELECT id FROM sales_orders WHERE so_number = ?', [
		so.so_number,
	]);

	// Tally total sqft_produced per SKU across all runs in this SO
	const sqftBySku = {};
	for (const run of so.runs) {
		sqftBySku[run.sku_code] = (sqftBySku[run.sku_code] ?? 0) + run.sqft;
	}

	// Upsert SO lines
	for (const [skuCode, total] of Object.entries(sqftBySku)) {
		const skuId = sid(skuCode);
		await db.query(
			`INSERT INTO sales_order_lines (so_id, sku_id, sqft_ordered, sqft_produced)
			 VALUES (?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE sqft_produced = VALUES(sqft_produced)`,
			[soId, skuId, total, total]
		);
	}

	for (const run of so.runs) {
		const skuId = sid(run.sku_code);
		const runDate = run.confirmed_at.slice(0, 10);

		const [[existingRun]] = await db.query(
			'SELECT id FROM production_runs WHERE run_number = ?',
			[run.run_number]
		);
		if (existingRun) {
			console.log(`  skipped (exists): ${run.run_number}`);
			continue;
		}

		const [[{ id: solId }]] = await db.query(
			'SELECT id FROM sales_order_lines WHERE so_id = ? AND sku_id = ?',
			[soId, skuId]
		);

		const [runResult] = await db.query(
			`INSERT INTO production_runs
			 (run_number, so_line_id, sku_id, run_date, sqft_scheduled, sqft_actual, status, confirmed_at, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?)`,
			[
				run.run_number,
				solId,
				skuId,
				runDate,
				run.sqft,
				run.sqft,
				run.confirmed_at,
				run.confirmed_at,
			]
		);
		const runId = runResult.insertId;

		const [[txExists]] = await db.query(
			'SELECT id FROM inventory_transactions WHERE reference_type = ? AND reference_id = ?',
			['PRODUCTION_RUN', runId]
		);
		if (!txExists) {
			await db.query(
				`INSERT INTO inventory_transactions
				 (sku_id, transaction_type, sqft_quantity, reference_type, reference_id, memo, created_at)
				 VALUES (?, 'CONSUMPTION', ?, 'PRODUCTION_RUN', ?, ?, ?)`,
				[
					skuId,
					run.sqft,
					runId,
					`Confirmed ${run.run_number} — ${so.job_name}`,
					run.confirmed_at,
				]
			);
		}
		console.log(
			`  ✓ CONSUMPTION  ${so.customer_name.padEnd(22)} ${run.run_number}  ${run.sku_code}  ${run.sqft.toLocaleString()} sqft  [${runDate}]`
		);
	}
}

await db.end();
console.log('\nDone.\n');
