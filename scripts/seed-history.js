/**
 * Seed 10 days of historical PO receipts and confirmed production runs.
 * Safe to re-run - skips records that already exist.
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

