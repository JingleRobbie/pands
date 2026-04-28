import { fail } from '@sveltejs/kit';
import xlsx from 'xlsx';
import { db } from '$lib/db.js';
import { requireAdmin } from '$lib/auth.js';

const VENDOR_MAP = {
	'JOHNS MANVILLE': 'Johns Manville',
	CERTAINTEED: 'Certainteed',
};

function normalizeVendor(raw) {
	const up = String(raw).toUpperCase();
	for (const [k, v] of Object.entries(VENDOR_MAP)) {
		if (up.includes(k)) return v;
	}
	return null;
}

function xlsmDate(str) {
	const [m, d, y] = String(str).split('/');
	const year = parseInt(y) + (parseInt(y) < 100 ? 2000 : 0);
	return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function dbDate(val) {
	if (!val) return '';
	if (val instanceof Date) {
		return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
	}
	return String(val).slice(0, 10);
}

export async function load({ locals }) {
	return { user: locals.appUser };
}

export const actions = {
	parse: async ({ request }) => {
		const data = await request.formData();
		const file = data.get('xlsm');
		if (!file || file.size === 0) return fail(400, { error: 'No file selected.' });

		let rows;
		try {
			const buffer = Buffer.from(await file.arrayBuffer());
			const workbook = xlsx.read(buffer, { type: 'buffer' });
			const sheet = workbook.Sheets['Formatted'];
			if (!sheet)
				return fail(400, { error: 'Sheet "Formatted" not found in uploaded file.' });
			rows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
		} catch {
			return fail(400, {
				error: 'Could not parse file. Make sure it is a valid .xlsm workbook.',
			});
		}

		const [skus] = await db.query('SELECT id, sku_code FROM material_skus');
		const skuByCode = Object.fromEntries(skus.map((s) => [s.sku_code, s.id]));
		const skuCodeById = Object.fromEntries(skus.map((s) => [s.id, s.sku_code]));

		const poMap = new Map();
		const errors = [];

		for (const row of rows) {
			const poNum = String(row['Num'] ?? '').trim();
			const vendorRaw = String(row['Name'] ?? '').trim();
			const delivDate = String(row['Deliv Date'] ?? '').trim();
			const itemCode = String(row['Item Code'] ?? '').trim();
			const qtyRaw = String(row['Qty'] ?? '').trim();

			if (!poNum || !itemCode) continue;

			const vendor = normalizeVendor(vendorRaw);
			if (!vendor) {
				errors.push(`Unknown vendor "${vendorRaw}" on PO ${poNum}.`);
				continue;
			}

			const skuId = skuByCode[itemCode];
			if (!skuId) {
				errors.push(`Unknown SKU "${itemCode}" on PO ${poNum}.`);
				continue;
			}

			const sqft = parseInt(qtyRaw.replace(/\D/g, ''), 10);
			if (!sqft || sqft < 1) {
				errors.push(`Invalid quantity "${qtyRaw}" on PO ${poNum}.`);
				continue;
			}

			if (!poMap.has(poNum)) {
				poMap.set(poNum, {
					po_number: poNum,
					vendor_name: vendor,
					expected_date: xlsmDate(delivDate),
					lines: [],
				});
			}
			poMap.get(poNum).lines.push({ sku_id: skuId, sku_code: itemCode, sqft_ordered: sqft });
		}

		if (errors.length) return fail(400, { error: errors.join(' ') });
		if (!poMap.size)
			return fail(400, { error: 'No valid rows parsed from the "Formatted" sheet.' });

		// Load ALL open POs from the database
		const [existingRows] = await db.query(
			`SELECT po.id, po.po_number, po.vendor_name, po.expected_date,
			        pol.id AS line_id, pol.sku_id, pol.sqft_ordered
			 FROM purchase_orders po
			 LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id AND pol.status = 'OPEN'
			 WHERE po.status = 'OPEN'`
		);

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

		const preview = [];

		// New and changed/unchanged POs (in file)
		for (const [poNum, filePo] of poMap) {
			const existing = existingByPoNum[poNum];
			if (!existing) {
				preview.push({ ...filePo, status: 'new' });
				continue;
			}

			const dateChanged = filePo.expected_date !== existing.expected_date;
			const vendorChanged = filePo.vendor_name !== existing.vendor_name;
			const dbBySku = Object.fromEntries(existing.lines.map((l) => [l.sku_id, l]));
			const fileBySku = Object.fromEntries(filePo.lines.map((l) => [l.sku_id, l]));
			const linesAdded = filePo.lines.filter((l) => !dbBySku[l.sku_id]);
			const linesRemoved = existing.lines.filter((l) => !fileBySku[l.sku_id]);
			const linesChanged = filePo.lines
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
				...filePo,
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

		// Removed POs (in DB but not in file)
		for (const [poNum, existing] of Object.entries(existingByPoNum)) {
			if (!poMap.has(poNum)) {
				preview.push({
					po_number: poNum,
					vendor_name: existing.vendor_name,
					expected_date: existing.expected_date,
					lines: existing.lines,
					status: 'removed',
					existing_id: existing.id,
				});
			}
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
			let cancelled = 0;

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
				} else if (po.status === 'removed') {
					await conn.query(
						"UPDATE purchase_orders SET status = 'CANCELLED' WHERE id = ?",
						[po.existing_id]
					);
					await conn.query(
						"UPDATE purchase_order_lines SET status = 'CANCELLED' WHERE po_id = ? AND status = 'OPEN'",
						[po.existing_id]
					);
					cancelled++;
				}
			}

			await conn.commit();
			return { success: true, created, updated, cancelled };
		} catch (err) {
			await conn.rollback();
			return fail(500, { error: err.message });
		} finally {
			conn.release();
		}
	},
};
