import { db } from '$lib/db.js';

export async function createNPO({ soNumber, customerId, jobName, shipDate, shipAsap, lines }, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [[customer]] = await conn.query('SELECT name FROM customers WHERE id = ?', [customerId]);
		if (!customer) throw new Error('Customer not found.');

		const [result] = await conn.query(
			`INSERT INTO work_orders
			 (so_number, customer_name, job_name, customer_id, ship_date, ship_asap, order_type, branch, created_by)
			 VALUES (?, ?, ?, ?, ?, ?, 'NON_PRODUCTION', '', ?)`,
			[soNumber, customer.name, jobName, customerId, shipDate || null, shipAsap ? 1 : 0, userId]
		);
		const woId = result.insertId;

		for (const line of lines) {
			await conn.query(
				`INSERT INTO work_order_lines
				 (wo_id, sku_id, thickness_in, width_in, qty, length_ft, sqft, facing, path_type)
				 VALUES (?, ?, ?, ?, ?, ?, ?, 'RAW', 'DIRECT_SHIP')`,
				[woId, line.skuId, line.thicknessIn, line.widthIn, line.qty, line.lengthFt, line.sqft]
			);
		}

		await conn.commit();
		return { woId };
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

export async function addNPOLine(woId, { skuId, thicknessIn, widthIn, qty, lengthFt, sqft }) {
	await db.query(
		`INSERT INTO work_order_lines
		 (wo_id, sku_id, thickness_in, width_in, qty, length_ft, sqft, facing, path_type)
		 VALUES (?, ?, ?, ?, ?, ?, ?, 'RAW', 'DIRECT_SHIP')`,
		[woId, skuId, thicknessIn, widthIn, qty, lengthFt, sqft]
	);
}

export async function removeNPOLine(woId, lineId) {
	const [[line]] = await db.query(
		'SELECT id FROM work_order_lines WHERE id = ? AND wo_id = ?',
		[lineId, woId]
	);
	if (!line) throw new Error('Line not found on this NPO.');

	const [[{ onShipment }]] = await db.query(
		'SELECT COUNT(*) AS onShipment FROM shipment_lines WHERE wo_line_id = ?',
		[lineId]
	);
	if (onShipment > 0) throw new Error('Cannot remove a line that is already on a shipment.');

	await db.query('DELETE FROM work_order_lines WHERE id = ?', [lineId]);
}
