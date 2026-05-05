import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

async function nextRunNumber(conn) {
	const today = localDate().replace(/-/g, '');
	const prefix = `PR-${today}-`;
	const [[{ last }]] = await conn.query(
		'SELECT MAX(run_number) AS last FROM production_runs WHERE run_number LIKE ?',
		[`${prefix}%`]
	);
	const seq = last ? parseInt(last.slice(-3)) + 1 : 1;
	return `${prefix}${String(seq).padStart(3, '0')}`;
}

function prorateSqft(partRolls, totalRolls, totalSqft) {
	return partRolls === totalRolls
		? Number(totalSqft)
		: Math.round((Number(partRolls) / Number(totalRolls)) * Number(totalSqft));
}

function validateRollsToShip(rollsToShip, availableRolls) {
	if (!Number.isInteger(rollsToShip) || rollsToShip < 1) {
		throw new Error('Rolls to ship must be greater than zero.');
	}
	if (rollsToShip > availableRolls) {
		throw new Error(
			`Cannot ship ${rollsToShip} rolls - only ${availableRolls} rolls are available.`
		);
	}
}

async function createRemainderRun(conn, sourceRunId, remainderRolls, remainderSqft, userId) {
	const remainderNumber = await nextRunNumber(conn);
	await conn.query(
		`INSERT INTO production_runs
		 (run_number, group_id, wo_line_id, sku_id, run_date,
		  rolls_scheduled, sqft_scheduled, rolls_actual, sqft_actual, status, confirmed_at, created_by)
		 SELECT ?, group_id, wo_line_id, sku_id, run_date,
		        ?, ?, ?, ?, 'COMPLETED', confirmed_at, ?
		 FROM production_runs WHERE id = ?`,
		[
			remainderNumber,
			remainderRolls,
			remainderSqft,
			remainderRolls,
			remainderSqft,
			userId,
			sourceRunId,
		]
	);
}

async function splitRunForShipment(conn, run, rollsToShip, userId) {
	const availableRolls = Number(run.rolls_actual);
	const availableSqft = Number(run.sqft_actual);
	validateRollsToShip(rollsToShip, availableRolls);

	const sqftToShip = prorateSqft(rollsToShip, availableRolls, availableSqft);
	if (rollsToShip < availableRolls) {
		const remainderRolls = availableRolls - rollsToShip;
		const remainderSqft = availableSqft - sqftToShip;

		await conn.query(
			`UPDATE production_runs SET rolls_actual = ?, sqft_actual = ? WHERE id = ?`,
			[rollsToShip, sqftToShip, run.id]
		);
		await createRemainderRun(conn, run.id, remainderRolls, remainderSqft, userId);
	}

	return { rolls: rollsToShip, sqft: sqftToShip };
}

async function reduceShipmentLine(conn, line, newRolls, userId) {
	const originalRolls = Number(line.rolls);
	if (!newRolls) return null;
	validateRollsToShip(newRolls, originalRolls);
	if (newRolls === originalRolls) return null;

	const originalSqft = Number(line.sqft);
	const newSqft = prorateSqft(newRolls, originalRolls, originalSqft);
	const remainderRolls = originalRolls - newRolls;
	const remainderSqft = originalSqft - newSqft;

	await conn.query(`UPDATE shipment_lines SET rolls = ?, sqft = ? WHERE id = ?`, [
		newRolls,
		newSqft,
		line.id,
	]);
	await createRemainderRun(conn, line.production_run_id, remainderRolls, remainderSqft, userId);

	return { rolls: newRolls, sqft: newSqft };
}

// rollsMap: { [runId]: rollsToShip } - omit a key to ship all rolls for that run
export async function createShipment(woId, customerId, shipDate, runIds, userId, rollsMap = {}) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const ph = runIds.map(() => '?').join(',');
		const [runs] = await conn.query(
			`SELECT pr.id, pr.run_number, pr.sku_id, pr.wo_line_id, pr.group_id,
			        pr.rolls_actual, pr.sqft_actual, pr.run_date, wol.wo_id
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
			const rollsToShip = Number(rollsMap[run.id] ?? run.rolls_actual);
			const shipped = await splitRunForShipment(conn, run, rollsToShip, userId);

			await conn.query(
				`INSERT INTO shipment_lines (shipment_id, production_run_id, sku_id, rolls, sqft)
				 VALUES (?, ?, ?, ?, ?)`,
				[shipmentId, run.id, run.sku_id, shipped.rolls, shipped.sqft]
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

// removeLineIds: line IDs to delete; lineRolls: {lineId: newRolls} to reduce; addRunIds + addRollsMap: new runs
export async function updateShipment(
	shipmentId,
	{ removeLineIds = [], lineRolls = {}, addRunIds = [], addRollsMap = {}, shipDate = null },
	userId
) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		if (shipDate) {
			await conn.query(`UPDATE shipments SET ship_date = ? WHERE id = ?`, [
				shipDate,
				shipmentId,
			]);
		}

		const [lines] = await conn.query(
			`SELECT sl.id, sl.production_run_id, sl.sku_id, sl.rolls, sl.sqft,
			        pr.rolls_actual, pr.sqft_actual
			 FROM shipment_lines sl
			 JOIN production_runs pr ON pr.id = sl.production_run_id
			 WHERE sl.shipment_id = ?`,
			[shipmentId]
		);

		if (removeLineIds.length > 0) {
			const ph = removeLineIds.map(() => '?').join(',');
			await conn.query(`DELETE FROM shipment_lines WHERE id IN (${ph}) AND shipment_id = ?`, [
				...removeLineIds,
				shipmentId,
			]);
		}

		for (const line of lines) {
			if (removeLineIds.includes(line.id)) continue;
			await reduceShipmentLine(conn, line, Number(lineRolls[line.id]), userId);
		}

		if (addRunIds.length > 0) {
			const ph = addRunIds.map(() => '?').join(',');
			const [runs] = await conn.query(
				`SELECT pr.id, pr.sku_id, pr.rolls_actual, pr.sqft_actual
				 FROM production_runs pr WHERE pr.id IN (${ph}) AND pr.status = 'COMPLETED'`,
				addRunIds
			);
			for (const run of runs) {
				const rollsToShip = Number(addRollsMap[run.id] ?? run.rolls_actual);
				const shipped = await splitRunForShipment(conn, run, rollsToShip, userId);
				await conn.query(
					`INSERT INTO shipment_lines (shipment_id, production_run_id, sku_id, rolls, sqft) VALUES (?, ?, ?, ?, ?)`,
					[shipmentId, run.id, run.sku_id, shipped.rolls, shipped.sqft]
				);
			}
		}

		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

// lineRolls: { [lineId]: newRolls } - splits remainder runs for any reductions
export async function confirmShipment(shipmentId, lineRolls = {}, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [lines] = await conn.query(
			`SELECT sl.id, sl.production_run_id, sl.rolls, sl.sqft
			 FROM shipment_lines sl WHERE sl.shipment_id = ?`,
			[shipmentId]
		);

		for (const line of lines) {
			await reduceShipmentLine(conn, line, Number(lineRolls[line.id]), userId);
		}

		await conn.query(`UPDATE shipments SET status = 'SHIPPED' WHERE id = ?`, [shipmentId]);
		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
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
		`SELECT sl.*, ms.display_label, pr.run_number, pr.run_date,
		        wol.rollfor, wol.facing, wol.thickness_in, wol.width_in, wol.length_ft
		 FROM shipment_lines sl
		 JOIN material_skus ms ON ms.id = sl.sku_id
		 JOIN production_runs pr ON pr.id = sl.production_run_id
		 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		 WHERE sl.shipment_id = ?
		 ORDER BY ms.sort_order, pr.run_number`,
		[id]
	);

	return { ...shipment, lines };
}

export async function revertShipment(shipmentId) {
	await db.query("UPDATE shipments SET status = 'DRAFT' WHERE id = ?", [shipmentId]);
}

export async function getAllShipments({ status = 'draft', from = '' } = {}) {
	const where = [];
	const params = [];
	if (status === 'draft') {
		where.push("s.status = 'DRAFT'");
	} else if (status === 'shipped') {
		where.push("s.status = 'SHIPPED'");
	}
	if (from) {
		where.push('s.ship_date >= ?');
		params.push(from);
	}

	const [rows] = await db.query(
		`SELECT s.id, s.shipment_number, s.ship_date, s.status,
		        wo.id AS wo_id, wo.so_number, wo.job_name,
		        c.name AS customer_name,
		        SUM(sl.sqft) AS total_sqft,
		        SUM(sl.rolls) AS total_rolls,
		        (
		          EXISTS (SELECT 1 FROM work_order_lines wl3 WHERE wl3.wo_id = wo.id)
		          AND
		          (SELECT COUNT(*) FROM work_order_lines wl
		             WHERE wl.wo_id = wo.id AND wl.rolls_produced < wl.qty) = 0
		          AND
		          (SELECT COALESCE(SUM(sl2.rolls), 0)
		             FROM shipments s2
		             JOIN shipment_lines sl2 ON sl2.shipment_id = s2.id
		             WHERE s2.wo_id = wo.id AND s2.status = 'SHIPPED')
		          >=
		          (SELECT COALESCE(SUM(wl2.qty), 0) FROM work_order_lines wl2 WHERE wl2.wo_id = wo.id)
		        ) AS wo_fully_shipped
		 FROM shipments s
		 JOIN work_orders wo ON wo.id = s.wo_id
		 JOIN customers c ON c.id = s.customer_id
		 LEFT JOIN shipment_lines sl ON sl.shipment_id = s.id
		 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
		 GROUP BY s.id
		 ORDER BY s.ship_date DESC, s.id DESC`,
		params
	);
	return rows;
}

export const __shippingTest = {
	prorateSqft,
	validateRollsToShip,
};
