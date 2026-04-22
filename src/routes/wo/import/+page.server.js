import { fail } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import { requireAdmin } from '$lib/auth.js';
import { parseWorkOrderExcel } from '$lib/parseWO.js';

export async function load({ locals }) {
	return { user: locals.appUser };
}

function parseExcelDate(str) {
	if (!str) return null;
	const parts = String(str).split('/');
	if (parts.length !== 3) return null;
	const [m, d, y] = parts;
	const year = parseInt(y) + (parseInt(y) < 100 ? 2000 : 0);
	return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function dbDate(val) {
	return val?.toISOString?.().slice(0, 10) ?? String(val).slice(0, 10);
}

function parseDeliveryAddress(str) {
	if (!str) return { addr1: null, city: null, state: null, zip: null };
	const parts = str.split(', ');

	// Last part is "STATE ZIP" e.g. "OK 74601"
	const last = parts[parts.length - 1];
	const stateZip = last.match(/^([A-Z]{2})\s+(\d{5}(-\d{4})?)$/);
	if (stateZip) {
		const state = stateZip[1];
		const zip = stateZip[2];
		const city = parts.length >= 2 ? parts[parts.length - 2] : null;
		const addr1 = parts.length >= 3 ? parts.slice(0, -2).join(', ') : null;
		return { addr1: addr1 || null, city: city || null, state, zip };
	}

	// Last part contains city + state + zip e.g. "Ponca City OK 74601"
	const fallback = last.match(/^(.*?),?\s+([A-Z]{2})\s+(\d{5}(-\d{4})?)$/);
	if (fallback) {
		const city = fallback[1].trim() || null;
		const state = fallback[2];
		const zip = fallback[3];
		const addr1 = parts.length >= 2 ? parts.slice(0, -1).join(', ') : null;
		return { addr1: addr1 || null, city, state, zip };
	}

	return { addr1: str, city: null, state: null, zip: null };
}

export const actions = {
	parse: async ({ request }) => {
		const data = await request.formData();
		const file = data.get('excel');
		if (!file || file.size === 0) return fail(400, { error: 'No file selected.' });

		let parsed;
		try {
			const buffer = Buffer.from(await file.arrayBuffer());
			parsed = parseWorkOrderExcel(buffer);
		} catch (err) {
			return fail(400, { error: `Could not parse workbook: ${err.message}` });
		}

		const { header, accessories, lines } = parsed;

		if (!header.so_number) return fail(400, { error: 'SO number not found in workbook.' });

		const [skus] = await db.query(
			'SELECT id, thickness_in, width_in, display_label FROM material_skus WHERE is_active = TRUE'
		);
		const skuByDims = Object.fromEntries(
			skus.map((s) => [`${s.thickness_in}_${s.width_in}`, s])
		);

		const errors = [];
		const woLines = [];
		for (const ln of lines) {
			const thickness = parseFloat(ln.thickness);
			const width = parseInt(ln.width);
			const qty = parseInt(ln.roll_qty);
			const lengthFt = parseFloat(ln.length);

			const sku = skuByDims[`${thickness}_${width}`];
			if (!sku) {
				errors.push(`Unknown SKU ${thickness}"×${width}" on row ${ln.row}.`);
				continue;
			}
			if (!qty || qty < 1 || !lengthFt || lengthFt <= 0) {
				errors.push(`Invalid qty/length on row ${ln.row}.`);
				continue;
			}

			const sqft = Math.round(qty * (width / 12) * lengthFt);
			woLines.push({
				sku_id: sku.id,
				thickness_in: sku.thickness_in,
				width_in: sku.width_in,
				display_label: sku.display_label,
				qty,
				length_ft: lengthFt,
				sqft,
				rollfor: ln.roll_for || '',
				facing: ln.facing || '',
				instructions: ln.instructions || '',
				tab_type: ln.tab_type || '',
			});
		}

		if (errors.length) return fail(400, { error: errors.join(' ') });
		if (!woLines.length) return fail(400, { error: 'No valid line items found in workbook.' });

		const { addr1, city, state, zip } = parseDeliveryAddress(header.delivery_address);

		const wo = {
			so_number: header.so_number,
			customer_name: header.customer,
			job_name: header.job_name,
			branch: header.branch,
			ship_date: parseExcelDate(header.deliver_on),
			ship_addr1: addr1,
			ship_city: city,
			ship_state: state,
			ship_zip: zip,
			contact_name: header.contact || null,
			contact_phone: header.phone || null,
			accessories,
			lines: woLines,
		};

		// Check for existing WO
		const [[existingRow]] = await db.query(
			`SELECT wo.id, wo.customer_name, wo.job_name, wo.branch, wo.ship_date,
			        COUNT(wol.id) AS line_count, COALESCE(SUM(wol.sqft), 0) AS total_sqft
			 FROM work_orders wo
			 LEFT JOIN work_order_lines wol ON wol.wo_id = wo.id
			 WHERE wo.so_number = ?
			 GROUP BY wo.id`,
			[wo.so_number]
		);

		if (!existingRow) {
			wo.status = 'new';
		} else {
			const csvTotal = woLines.reduce((s, l) => s + l.sqft, 0);
			const hasChanges =
				wo.customer_name !== existingRow.customer_name ||
				wo.job_name !== existingRow.job_name ||
				wo.branch !== existingRow.branch ||
				wo.ship_date !== dbDate(existingRow.ship_date) ||
				woLines.length !== existingRow.line_count ||
				csvTotal !== existingRow.total_sqft;
			wo.status = hasChanges ? 'changed' : 'unchanged';
			wo.existing_id = existingRow.id;
		}

		return { preview: [wo] };
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
					const [[matchedCustomer]] = await conn.query(
						'SELECT id FROM customers WHERE LOWER(name) = LOWER(?)',
						[wo.customer_name]
					);
					const [result] = await conn.query(
						'INSERT INTO work_orders (so_number, customer_name, job_name, branch, ship_date, customer_id, ship_addr1, ship_city, ship_state, ship_zip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
						[
							wo.so_number,
							wo.customer_name,
							wo.job_name,
							wo.branch,
							wo.ship_date,
							matchedCustomer?.id ?? null,
							wo.ship_addr1,
							wo.ship_city,
							wo.ship_state,
							wo.ship_zip,
						]
					);
					const woId = result.insertId;

					for (const line of wo.lines) {
						await conn.query(
							'INSERT INTO work_order_lines (wo_id, sku_id, thickness_in, width_in, qty, length_ft, sqft, rollfor, facing, instructions, tab_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
							[
								woId,
								line.sku_id,
								line.thickness_in,
								line.width_in,
								line.qty,
								line.length_ft,
								line.sqft,
								line.rollfor,
								line.facing,
								line.instructions,
								line.tab_type || null,
							]
						);
					}

					if (wo.contact_name) {
						await conn.query(
							'INSERT INTO contacts (wo_id, name, phone) VALUES (?, ?, ?)',
							[woId, wo.contact_name, wo.contact_phone || null]
						);
					}

					for (const acc of wo.accessories || []) {
						await conn.query(
							'INSERT INTO wo_accessories (wo_id, qty, part_number, description) VALUES (?, ?, ?, ?)',
							[woId, acc.qty, acc.part_number, acc.description]
						);
					}

					created++;
				} else if (wo.status === 'changed') {
					const [[matchedCustomer]] = await conn.query(
						'SELECT id FROM customers WHERE LOWER(name) = LOWER(?)',
						[wo.customer_name]
					);
					await conn.query(
						'UPDATE work_orders SET customer_name=?, job_name=?, branch=?, ship_date=?, customer_id=COALESCE(customer_id, ?), ship_addr1=?, ship_city=?, ship_state=?, ship_zip=? WHERE id=?',
						[
							wo.customer_name,
							wo.job_name,
							wo.branch,
							wo.ship_date,
							matchedCustomer?.id ?? null,
							wo.ship_addr1,
							wo.ship_city,
							wo.ship_state,
							wo.ship_zip,
							wo.existing_id,
						]
					);

					await conn.query('DELETE FROM work_order_lines WHERE wo_id = ?', [
						wo.existing_id,
					]);
					await conn.query('DELETE FROM contacts WHERE wo_id = ?', [wo.existing_id]);
					await conn.query('DELETE FROM wo_accessories WHERE wo_id = ?', [
						wo.existing_id,
					]);

					for (const line of wo.lines) {
						await conn.query(
							'INSERT INTO work_order_lines (wo_id, sku_id, thickness_in, width_in, qty, length_ft, sqft, rollfor, facing, instructions, tab_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
								line.tab_type || null,
							]
						);
					}

					if (wo.contact_name) {
						await conn.query(
							'INSERT INTO contacts (wo_id, name, phone) VALUES (?, ?, ?)',
							[wo.existing_id, wo.contact_name, wo.contact_phone || null]
						);
					}

					for (const acc of wo.accessories || []) {
						await conn.query(
							'INSERT INTO wo_accessories (wo_id, qty, part_number, description) VALUES (?, ?, ?, ?)',
							[wo.existing_id, acc.qty, acc.part_number, acc.description]
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
