import { fail } from '@sveltejs/kit';
import xlsx from 'xlsx';
import { db } from '$lib/db.js';
import { requireAdmin } from '$lib/auth.js';

const VENDOR_MAP = {
	'JOHNS MANVILLE': 'Johns Manville',
	CERTAINTEED: 'Certainteed',
};

const SOURCE_SHEET_NAME = 'Sheet1';
const FLATTENED_SHEET_NAME = 'Formatted';

function normalizeVendor(raw) {
	const up = String(raw).toUpperCase();
	for (const [k, v] of Object.entries(VENDOR_MAP)) {
		if (up.includes(k)) return v;
	}
	return null;
}

function clean(value) {
	return String(value ?? '').trim();
}

function xlsmDate(value) {
	if (!value) return '';
	if (value instanceof Date) {
		return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
	}
	const str = clean(value);
	const [m, d, y] = str.split('/');
	if (!m || !d || !y) return '';
	const year = parseInt(y, 10) + (parseInt(y, 10) < 100 ? 2000 : 0);
	if (!year || !parseInt(m, 10) || !parseInt(d, 10)) return '';
	return `${year}-${String(parseInt(m, 10)).padStart(2, '0')}-${String(parseInt(d, 10)).padStart(2, '0')}`;
}

function parseSqft(value) {
	if (typeof value === 'number') return Math.round(value);
	const cleaned = clean(value).replace(/[$,\s]/g, '');
	const parsed = Number.parseFloat(cleaned);
	return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
}

function itemCodeFromHeading(value) {
	const text = clean(value);
	if (!text || text.startsWith('Total ')) return '';
	const match = text.match(/^(\d{4})\s*\(/);
	return match?.[1] ?? '';
}

function parseSourceSheet(sheet) {
	const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
	const parsedRows = [];
	let itemCode = '';

	for (const row of rows) {
		const headingCode = itemCodeFromHeading(row[3]);
		if (headingCode) {
			itemCode = headingCode;
			continue;
		}
		if (clean(row[3]).startsWith('Total ')) {
			itemCode = '';
			continue;
		}

		const poNum = clean(row[6]);
		if (!poNum || !itemCode) continue;

		parsedRows.push({
			Num: poNum,
			Name: row[7],
			'Deliv Date': row[10],
			'Item Code': itemCode,
			Qty: row[11],
		});
	}

	return parsedRows;
}

function parseFlattenedSheet(sheet) {
	return xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
}

function parsePoWorkbook(buffer) {
	const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
	if (workbook.Sheets[SOURCE_SHEET_NAME]) {
		return {
			rows: parseSourceSheet(workbook.Sheets[SOURCE_SHEET_NAME]),
			sourceSheet: SOURCE_SHEET_NAME,
		};
	}
	if (workbook.Sheets[FLATTENED_SHEET_NAME]) {
		return {
			rows: parseFlattenedSheet(workbook.Sheets[FLATTENED_SHEET_NAME]),
			sourceSheet: FLATTENED_SHEET_NAME,
		};
	}
	throw new Error(`Sheet "${SOURCE_SHEET_NAME}" not found in uploaded file.`);
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
		let sourceSheet;
		try {
			const buffer = Buffer.from(await file.arrayBuffer());
			({ rows, sourceSheet } = parsePoWorkbook(buffer));
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
			const poNum = clean(row['Num']);
			const vendorRaw = clean(row['Name']);
			const delivDate = clean(row['Deliv Date']);
			const itemCode = clean(row['Item Code']);
			const qtyRaw = row['Qty'];

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

			const expectedDate = xlsmDate(delivDate);
			if (!expectedDate) {
				errors.push(`Invalid delivery date "${delivDate}" on PO ${poNum}.`);
				continue;
			}

			const sqft = parseSqft(qtyRaw);
			if (!sqft || sqft < 1) {
				errors.push(`Invalid quantity "${clean(qtyRaw)}" on PO ${poNum}.`);
				continue;
			}

			if (!poMap.has(poNum)) {
				poMap.set(poNum, {
					po_number: poNum,
					vendor_name: vendor,
					expected_date: expectedDate,
					lines: [],
				});
			}
			const po = poMap.get(poNum);
			const existingLine = po.lines.find((line) => line.sku_id === skuId);
			if (existingLine) {
				existingLine.sqft_ordered += sqft;
			} else {
				po.lines.push({ sku_id: skuId, sku_code: itemCode, sqft_ordered: sqft });
			}
		}

		if (errors.length) return fail(400, { error: errors.join(' ') });
		if (!poMap.size)
			return fail(400, { error: `No valid rows parsed from the "${sourceSheet}" sheet.` });

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

export const __poImportTest = {
	parsePoWorkbook,
	parseSourceSheet,
	parseSqft,
};
