import { db } from '$lib/db.js';

export async function createShipment(woId, customerId, shipDate, runIds, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		// Validate all runs are COMPLETED and belong to this WO
		const ph = runIds.map(() => '?').join(',');
		const [runs] = await conn.query(
			`SELECT pr.id, pr.sku_id, pr.rolls_actual, pr.sqft_actual, wol.wo_id
			 FROM production_runs pr
			 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
			 WHERE pr.id IN (${ph}) AND pr.status = 'COMPLETED'`,
			runIds
		);

		if (runs.length !== runIds.length) {
			throw new Error('One or more selected runs are not completed or do not exist.');
		}
		const wrongWo = runs.find((r) => r.wo_id !== woId);
		if (wrongWo) {
			throw new Error('All runs must belong to the selected work order.');
		}

		// Generate shipment number: {so_number}-S{N}
		const [[wo]] = await conn.query('SELECT so_number FROM work_orders WHERE id = ?', [woId]);
		const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM shipments WHERE wo_id = ?', [
			woId,
		]);
		const shipmentNumber = `${wo.so_number}-S${n + 1}`;

		const [result] = await conn.query(
			`INSERT INTO shipments (shipment_number, wo_id, customer_id, ship_date, created_by)
			 VALUES (?, ?, ?, ?, ?)`,
			[shipmentNumber, woId, customerId, shipDate, userId]
		);
		const shipmentId = result.insertId;

		for (const run of runs) {
			await conn.query(
				`INSERT INTO shipment_lines (shipment_id, production_run_id, sku_id, rolls, sqft)
				 VALUES (?, ?, ?, ?, ?)`,
				[shipmentId, run.id, run.sku_id, run.rolls_actual, run.sqft_actual]
			);
		}

		await conn.commit();
		return { shipmentId, shipmentNumber };
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

export async function markShipped(shipmentId) {
	await db.query(`UPDATE shipments SET status = 'SHIPPED' WHERE id = ?`, [shipmentId]);
}

export async function getShipment(id) {
	const [[shipment]] = await db.query(
		`SELECT s.*, wo.so_number, wo.job_name, wo.branch,
		        c.name AS customer_name, c.phone AS customer_phone
		 FROM shipments s
		 JOIN work_orders wo ON wo.id = s.wo_id
		 JOIN customers c ON c.id = s.customer_id
		 WHERE s.id = ?`,
		[id]
	);
	if (!shipment) return null;

	const [lines] = await db.query(
		`SELECT sl.*, ms.display_label, pr.run_number
		 FROM shipment_lines sl
		 JOIN material_skus ms ON ms.id = sl.sku_id
		 JOIN production_runs pr ON pr.id = sl.production_run_id
		 WHERE sl.shipment_id = ?
		 ORDER BY ms.sort_order, pr.run_number`,
		[id]
	);

	return { ...shipment, lines };
}

export async function getAllShipments() {
	const [rows] = await db.query(
		`SELECT s.id, s.shipment_number, s.ship_date, s.status,
		        wo.so_number, wo.job_name,
		        c.name AS customer_name,
		        SUM(sl.sqft) AS total_sqft,
		        SUM(sl.rolls) AS total_rolls
		 FROM shipments s
		 JOIN work_orders wo ON wo.id = s.wo_id
		 JOIN customers c ON c.id = s.customer_id
		 LEFT JOIN shipment_lines sl ON sl.shipment_id = s.id
		 GROUP BY s.id
		 ORDER BY s.ship_date DESC, s.id DESC`,
		[]
	);
	return rows;
}
