import { fail } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import { requireAdmin } from '$lib/auth.js';

const VENDORS = ['Johns Manville', 'Certainteed'];

export async function load({ locals }) {
	return { user: locals.appUser };
}

function parseCSVLine(line) {
	const fields = [];
	let cur = '';
	let inQ = false;
	for (const ch of line) {
		if (ch === '"') inQ = !inQ;
		else if (ch === ',' && !inQ) {
			fields.push(cur);
			cur = '';
		} else cur += ch;
	}
	fields.push(cur);
	return fields.map((f) => f.trim());
}

function csvDate(str) {
	const [m, d, y] = str.split('/');
	const year = parseInt(y) + (parseInt(y) < 100 ? 2000 : 0);
	return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function dbDate(val) {
	return val?.toISOString?.().slice(0, 10) ?? String(val).slice(0, 10);
}

export const actions = {
	parse: async ({ request }) => {
		const data = await request.formData();
		const file = data.get('csv');
		if (!file || file.size === 0) return fail(400, { error: 'No file selected.' });

		const text = await file.text();
		const lines = text.trim().split(/\r?\n/).slice(1);

		const [skus] = await db.query('SELECT id, sku_code FROM material_skus');
		const skuByCode = Object.fromEntries(skus.map((s) => [s.sku_code, s.id]));
		const skuCodeById = Object.fromEntries(skus.map((s) => [s.id, s.sku_code]));

		const poMap = new Map();
		const errors = [];

		for (const line of lines) {
			if (!line.trim()) continue;
			const [date, poNum, vendor, item, qty] = parseCSVLine(line);
			if (!VENDORS.includes(vendor)) {
				errors.push(`Unknown vendor "${vendor}" on PO ${poNum}.`);
				continue;
			}
			const skuId = skuByCode[item];
			if (!skuId) {
				errors.push(`Unknown SKU "${item}" on PO ${poNum}.`);
				continue;
			}
			const sqft = parseInt(qty.replace(/\D/g, ''), 10);
			if (!poMap.has(poNum)) {
				poMap.set(poNum, {
					po_number: poNum,
					vendor_name: vendor,
					expected_date: csvDate(date),
					lines: [],
				});
			}
			poMap.get(poNum).lines.push({ sku_id: skuId, sku_code: item, sqft_ordered: sqft });
		}

		if (errors.length) return fail(400, { error: errors.join(' ') });
		if (!poMap.size) return fail(400, { error: 'No valid rows parsed.' });

		// Load existing POs + open lines
		const poNumbers = [...poMap.keys()];
		const ph = poNumbers.map(() => '?').join(',');
		const [existingRows] = await db.query(
			`SELECT po.id, po.po_number, po.vendor_name, po.expected_date,
			        pol.id AS line_id, pol.sku_id, pol.sqft_ordered
			 FROM purchase_orders po
			 LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id AND pol.status = 'OPEN'
			 WHERE po.po_number IN (${ph})`,
			poNumbers
		);

		// Group by po_number
		const existingByPoNum = {};
		for (const row of existingRows) {
			if (!existingByPoNum[row.po_number]) {
				existingByPoNum[row.po_number] = {
					id: row.id,
					vendor_name: row.vendor_name,
					expected_date: dbDate(row.expected_date),
					lines: [],
				};
			}
			if (row.line_id) {
				existingByPoNum[row.po_number].lines.push({
					line_id: row.line_id,
					sku_id: row.sku_id,
					sku_code: skuCodeById[row.sku_id],
					sqft_ordered: row.sqft_ordered,
				});
			}
		}

		// Build preview with diff
		const preview = [];
		for (const [poNum, csvPo] of poMap) {
			const existing = existingByPoNum[poNum];
			if (!existing) {
				preview.push({ ...csvPo, status: 'new' });
				continue;
			}

			const dateChanged = csvPo.expected_date !== existing.expected_date;
			const vendorChanged = csvPo.vendor_name !== existing.vendor_name;
			const dbBySku = Object.fromEntries(existing.lines.map((l) => [l.sku_id, l]));
			const csvBySku = Object.fromEntries(csvPo.lines.map((l) => [l.sku_id, l]));
			const linesAdded = csvPo.lines.filter((l) => !dbBySku[l.sku_id]);
			const linesRemoved = existing.lines.filter((l) => !csvBySku[l.sku_id]);
			const linesChanged = csvPo.lines
				.filter(
					(l) => dbBySku[l.sku_id] && dbBySku[l.sku_id].sqft_ordered !== l.sqft_ordered
				)
				.map((l) => ({ ...l, old_sqft: dbBySku[l.sku_id].sqft_ordered }));

			const hasChanges =
				dateChanged ||
				vendorChanged ||
				linesAdded.length ||
				linesRemoved.length ||
				linesChanged.length;

			preview.push({
				...csvPo,
				status: hasChanges ? 'changed' : 'unchanged',
				existing_id: existing.id,
				diff: {
					dateChanged,
					oldDate: existing.expected_date,
					vendorChanged,
					oldVendor: existing.vendor_name,
					linesAdded,
					linesRemoved,
					linesChanged,
				},
			});
		}

		return { preview };
	},

	import: async ({ request, locals }) => {
		const denied = requireAdmin(locals);
		if (denied) return denied;
		const data = await request.formData();
		const accepted = new Set(data.getAll('accepted'));
		let preview;
		try {
			preview = JSON.parse(data.get('csv_data'));
		} catch {
			return fail(400, { error: 'Invalid import data.' });
		}

		const conn = await db.getConnection();
		try {
			await conn.beginTransaction();
			let created = 0;
			let updated = 0;

			for (const po of preview) {
				if (!accepted.has(po.po_number)) continue;

				if (po.status === 'new') {
					const [result] = await conn.query(
						'INSERT INTO purchase_orders (po_number, vendor_name, expected_date) VALUES (?, ?, ?)',
						[po.po_number, po.vendor_name, po.expected_date]
					);
					for (const line of po.lines) {
						await conn.query(
							'INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered) VALUES (?, ?, ?)',
							[result.insertId, line.sku_id, line.sqft_ordered]
						);
					}
					created++;
				} else if (po.status === 'changed') {
					await conn.query(
						'UPDATE purchase_orders SET vendor_name = ?, expected_date = ? WHERE id = ?',
						[po.vendor_name, po.expected_date, po.existing_id]
					);
					await conn.query(
						"DELETE FROM purchase_order_lines WHERE po_id = ? AND status = 'OPEN'",
						[po.existing_id]
					);
					for (const line of po.lines) {
						await conn.query(
							'INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered) VALUES (?, ?, ?)',
							[po.existing_id, line.sku_id, line.sqft_ordered]
						);
					}
					updated++;
				}
			}

			await conn.commit();
			return { success: true, created, updated };
		} catch (err) {
			await conn.rollback();
			return fail(500, { error: err.message });
		} finally {
			conn.release();
		}
	},
};
