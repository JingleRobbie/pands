import { fail } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import { requireAdmin } from '$lib/auth.js';

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

		const [skus] = await db.query(
			'SELECT id, thickness_in, width_in, display_label FROM material_skus WHERE is_active = TRUE'
		);
		const skuByDims = Object.fromEntries(
			skus.map((s) => [`${s.thickness_in}_${s.width_in}`, s])
		);

		const woMap = new Map();
		const errors = [];

		for (const line of lines) {
			if (!line.trim()) continue;
			const [
				soNum,
				company,
				jobname,
				branch,
				shipdate,
				facing,
				qtyStr,
				thickStr,
				widthStr,
				lengthStr,
				rollfor,
				instructions,
			] = parseCSVLine(line);

			const thickness = parseFloat(thickStr);
			const width = parseInt(widthStr);
			const qty = parseInt(qtyStr);
			const lengthFt = parseFloat(lengthStr);

			const sku = skuByDims[`${thickness}_${width}`];
			if (!sku) {
				errors.push(`Unknown SKU ${thickness}"×${width}" on SO ${soNum}.`);
				continue;
			}
			if (!qty || qty < 1 || !lengthFt || lengthFt <= 0) {
				errors.push(`Invalid qty/length on SO ${soNum}.`);
				continue;
			}

			const sqft = Math.round(qty * (width / 12) * lengthFt);

			if (!woMap.has(soNum)) {
				woMap.set(soNum, {
					so_number: soNum,
					customer_name: company,
					job_name: jobname,
					branch,
					ship_date: csvDate(shipdate),
					lines: [],
				});
			}
			woMap.get(soNum).lines.push({
				sku_id: sku.id,
				thickness_in: sku.thickness_in,
				width_in: sku.width_in,
				display_label: sku.display_label,
				qty,
				length_ft: lengthFt,
				sqft,
				rollfor: rollfor || '',
				facing: facing || '',
				instructions: instructions || '',
			});
		}

		if (errors.length) return fail(400, { error: errors.join(' ') });
		if (!woMap.size) return fail(400, { error: 'No valid rows parsed.' });

		// Load existing work orders
		const soNumbers = [...woMap.keys()];
		const ph = soNumbers.map(() => '?').join(',');
		const [existingRows] = await db.query(
			`SELECT wo.id, wo.so_number, wo.customer_name, wo.job_name, wo.branch, wo.ship_date,
			        wol.id AS line_id, wol.sku_id, wol.sqft
			 FROM work_orders wo
			 LEFT JOIN work_order_lines wol ON wol.wo_id = wo.id
			 WHERE wo.so_number IN (${ph})`,
			soNumbers
		);

		const existingByNum = {};
		for (const row of existingRows) {
			if (!existingByNum[row.so_number]) {
				existingByNum[row.so_number] = {
					id: row.id,
					customer_name: row.customer_name,
					job_name: row.job_name,
					branch: row.branch,
					ship_date: dbDate(row.ship_date),
					lineCount: 0,
					totalSqft: 0,
				};
			}
			if (row.line_id) {
				existingByNum[row.so_number].lineCount++;
				existingByNum[row.so_number].totalSqft += row.sqft;
			}
		}

		const preview = [];
		for (const [soNum, csvWo] of woMap) {
			const existing = existingByNum[soNum];
			if (!existing) {
				preview.push({ ...csvWo, status: 'new' });
				continue;
			}

			const csvTotal = csvWo.lines.reduce((s, l) => s + l.sqft, 0);
			const hasChanges =
				csvWo.customer_name !== existing.customer_name ||
				csvWo.job_name !== existing.job_name ||
				csvWo.branch !== existing.branch ||
				csvWo.ship_date !== existing.ship_date ||
				csvWo.lines.length !== existing.lineCount ||
				csvTotal !== existing.totalSqft;

			preview.push({
				...csvWo,
				status: hasChanges ? 'changed' : 'unchanged',
				existing_id: existing.id,
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

			for (const wo of preview) {
				if (!accepted.has(wo.so_number)) continue;

				if (wo.status === 'new') {
					const [result] = await conn.query(
						'INSERT INTO work_orders (so_number, customer_name, job_name, branch, ship_date) VALUES (?, ?, ?, ?, ?)',
						[
							wo.so_number,
							wo.customer_name,
							wo.job_name,
							wo.branch,
							wo.ship_date,
						]
					);
					for (const line of wo.lines) {
						await conn.query(
							'INSERT INTO work_order_lines (wo_id, sku_id, thickness_in, width_in, qty, length_ft, sqft, rollfor, facing, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
							[
								result.insertId,
								line.sku_id,
								line.thickness_in,
								line.width_in,
								line.qty,
								line.length_ft,
								line.sqft,
								line.rollfor,
								line.facing,
								line.instructions,
							]
						);
					}
					created++;
				} else if (wo.status === 'changed') {
					await conn.query(
						'UPDATE work_orders SET customer_name=?, job_name=?, branch=?, ship_date=? WHERE id=?',
						[
							wo.customer_name,
							wo.job_name,
							wo.branch,
							wo.ship_date,
							wo.existing_id,
						]
					);
					await conn.query('DELETE FROM work_order_lines WHERE wo_id = ?', [
						wo.existing_id,
					]);
					for (const line of wo.lines) {
						await conn.query(
							'INSERT INTO work_order_lines (wo_id, sku_id, thickness_in, width_in, qty, length_ft, sqft, rollfor, facing, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
							[
								wo.existing_id,
								line.sku_id,
								line.thickness_in,
								line.width_in,
								line.qty,
								line.length_ft,
								line.sqft,
								line.rollfor,
								line.facing,
								line.instructions,
							]
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
