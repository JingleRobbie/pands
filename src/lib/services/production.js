import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

function todayStr() {
	return localDate();
}

async function nextRunNumber(conn = db) {
	const prefix = `PR-${todayStr().replace(/-/g, '')}-`;
	const [[{ last }]] = await conn.query(
		'SELECT MAX(run_number) AS last FROM production_runs WHERE run_number LIKE ?',
		[`${prefix}%`]
	);
	const seq = last ? parseInt(last.slice(-3)) + 1 : 1;
	return `${prefix}${String(seq).padStart(3, '0')}`;
}

function calcSqft(line, rolls) {
	return Math.round(Number(rolls) * (Number(line.width_in) / 12) * Number(line.length_ft));
}

function dateOnly(value) {
	if (!value) return null;
	return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

async function getLockedWoLine(conn, woLineId, notFoundMessage = 'WO line not found.') {
	const [[line]] = await conn.query('SELECT * FROM work_order_lines WHERE id = ? FOR UPDATE', [
		woLineId,
	]);
	if (!line) throw new Error(notFoundMessage);
	return line;
}

async function getRollsInOpenRuns(conn, woLineId) {
	const [[{ rollsInRuns }]] = await conn.query(
		`SELECT COALESCE(SUM(rolls_scheduled), 0) AS rollsInRuns
		 FROM production_runs WHERE wo_line_id = ? AND status != 'COMPLETED'`,
		[woLineId]
	);
	return Number(rollsInRuns);
}

async function getRemainingRolls(conn, line) {
	const rollsInRuns = await getRollsInOpenRuns(conn, line.id);
	return Number(line.qty) - Number(line.rolls_produced) - rollsInRuns;
}

function validateRollsScheduled(rollsScheduled, remaining, context = '') {
	if (rollsScheduled <= 0) throw new Error('Rolls scheduled must be greater than zero.');
	if (rollsScheduled > remaining) {
		const subject = context ? ` for ${context}` : '';
		throw new Error(
			`Cannot schedule ${rollsScheduled} rolls${subject} - only ${remaining} remaining.`
		);
	}
}

async function findExistingRun(conn, woLineId, runDate) {
	if (!runDate) return null;
	const [[existing]] = await conn.query(
		`SELECT id, run_number FROM production_runs
		 WHERE wo_line_id = ? AND run_date = ? AND status != 'COMPLETED' LIMIT 1`,
		[woLineId, runDate]
	);
	return existing ?? null;
}

async function findMatchingOpenRun(conn, woLineId, runDate) {
	const normalizedDate = runDate || null;
	const dateWhere = normalizedDate
		? 'run_date = ? AND status = ?'
		: 'run_date IS NULL AND status = ?';
	const params = normalizedDate
		? [woLineId, normalizedDate, 'SCHEDULED']
		: [woLineId, 'UNSCHEDULED'];
	const [[existing]] = await conn.query(
		`SELECT id, run_number
		 FROM production_runs
		 WHERE wo_line_id = ? AND ${dateWhere}
		 ORDER BY id
		 LIMIT 1`,
		params
	);
	return existing ?? null;
}

async function addToExistingRun(conn, existingRunId, rollsScheduled, sqftScheduled) {
	await conn.query(
		`UPDATE production_runs
		 SET rolls_scheduled = rolls_scheduled + ?, sqft_scheduled = sqft_scheduled + ?
		 WHERE id = ?`,
		[rollsScheduled, sqftScheduled, existingRunId]
	);
}

async function insertProductionRun(
	conn,
	{ groupId = null, woLineId, skuId, runDate, rollsScheduled, sqftScheduled, userId }
) {
	const runNumber = await nextRunNumber(conn);
	const status = runDate ? 'SCHEDULED' : 'UNSCHEDULED';

	await conn.query(
		`INSERT INTO production_runs
		 (run_number, group_id, wo_line_id, sku_id, run_date, rolls_scheduled, sqft_scheduled, status, created_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			runNumber,
			groupId,
			woLineId,
			skuId,
			runDate || null,
			rollsScheduled,
			sqftScheduled,
			status,
			userId ?? null,
		]
	);

	return runNumber;
}

async function prepareScheduleLine(conn, woLineId, rollsScheduled, lineContext = '') {
	const line = await getLockedWoLine(
		conn,
		woLineId,
		lineContext ? `WO line ${woLineId} not found.` : 'WO line not found.'
	);
	const remaining = await getRemainingRolls(conn, line);
	validateRollsScheduled(rollsScheduled, remaining, lineContext);

	return {
		line,
		sqftScheduled: calcSqft(line, rollsScheduled),
	};
}

async function getExistingGroupForDate(conn, woId, runDate) {
	if (!runDate) return null;
	const [[existingGroup]] = await conn.query(
		`SELECT pr.group_id
		 FROM production_runs pr
		 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		 WHERE wol.wo_id = ? AND pr.run_date = ? AND pr.status != 'COMPLETED'
		   AND pr.group_id IS NOT NULL
		 LIMIT 1`,
		[woId, runDate]
	);
	return existingGroup?.group_id ?? null;
}

async function getOrCreateGroup(conn, woId, runDate, userId) {
	const existingGroupId = await getExistingGroupForDate(conn, woId, runDate);
	if (existingGroupId) return existingGroupId;

	const [{ insertId }] = await conn.query(
		'INSERT INTO production_run_groups (created_by) VALUES (?)',
		[userId ?? null]
	);
	return insertId;
}

function validateConfirmableRun(run, rollsActual) {
	if (!run) throw new Error('Production run not found.');
	if (run.status === 'COMPLETED') throw new Error('This run is already completed.');
	if (run.run_date) {
		const runDateStr = dateOnly(run.run_date);
		if (todayStr() < runDateStr) {
			throw new Error(`Cannot confirm a run before its run date (${runDateStr}).`);
		}
	}
	if (rollsActual > run.rolls_scheduled) {
		throw new Error(
			`Cannot record ${rollsActual} rolls - only ${run.rolls_scheduled} rolls were scheduled.`
		);
	}
}

async function insertShortfallRun(
	conn,
	run,
	line,
	shortfallRolls,
	userId,
	{ runDate = null, groupId = null } = {}
) {
	const shortfallDate = runDate || null;
	const existing = await findMatchingOpenRun(conn, run.wo_line_id, shortfallDate);
	const sqftScheduled = calcSqft(line, shortfallRolls);
	if (existing) {
		await addToExistingRun(conn, existing.id, shortfallRolls, sqftScheduled);
		return existing.run_number;
	}

	const shortfallRunNumber = await nextRunNumber(conn);
	const status = shortfallDate ? 'SCHEDULED' : 'UNSCHEDULED';
	await conn.query(
		`INSERT INTO production_runs
		 (run_number, group_id, wo_line_id, sku_id, run_date, rolls_scheduled, sqft_scheduled, status, created_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			shortfallRunNumber,
			groupId,
			run.wo_line_id,
			run.sku_id,
			shortfallDate,
			shortfallRolls,
			sqftScheduled,
			status,
			userId ?? null,
		]
	);
	return shortfallRunNumber;
}

function prorateUnproduceSqft(line, run, rollsToUnproduce) {
	const rollsActual = Number(run.rolls_actual);
	if (rollsToUnproduce === rollsActual) return Number(run.sqft_actual);
	return calcSqft(line, rollsToUnproduce);
}

function validateUnproduceRolls(rollsToUnproduce, unshippedRolls) {
	if (!Number.isInteger(rollsToUnproduce) || rollsToUnproduce < 1) {
		throw new Error('Rolls to unproduce must be greater than zero.');
	}
	if (rollsToUnproduce > unshippedRolls) {
		throw new Error(
			`Cannot unproduce ${rollsToUnproduce} rolls - only ${unshippedRolls} rolls are unshipped.`
		);
	}
}

export async function scheduleRun(woLineId, runDate, rollsScheduled, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const { line, sqftScheduled } = await prepareScheduleLine(conn, woLineId, rollsScheduled);

		const existing = await findExistingRun(conn, woLineId, runDate);
		if (existing) {
			await addToExistingRun(conn, existing.id, rollsScheduled, sqftScheduled);
			await conn.commit();
			return existing.run_number;
		}

		const runNumber = await insertProductionRun(conn, {
			woLineId,
			skuId: line.sku_id,
			runDate,
			rollsScheduled,
			sqftScheduled,
			userId,
		});

		await conn.commit();
		return runNumber;
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

export async function scheduleGroup(woId, items, runDate, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		let groupId = null;

		for (const { woLineId, rollsScheduled } of items) {
			const { line, sqftScheduled } = await prepareScheduleLine(
				conn,
				woLineId,
				rollsScheduled,
				`line ${woLineId}`
			);

			const existing = await findExistingRun(conn, woLineId, runDate);
			if (existing) {
				await addToExistingRun(conn, existing.id, rollsScheduled, sqftScheduled);
				continue;
			}

			if (groupId === null) {
				groupId = await getOrCreateGroup(conn, woId, runDate, userId);
			}

			await insertProductionRun(conn, {
				groupId,
				woLineId,
				skuId: line.sku_id,
				runDate,
				rollsScheduled,
				sqftScheduled,
				userId,
			});
		}

		await conn.commit();
		return groupId;
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

export async function confirmRun(runId, rollsActual, userId, runDate = null) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [[run]] = await conn.query('SELECT * FROM production_runs WHERE id = ? FOR UPDATE', [
			runId,
		]);
		validateConfirmableRun(run, rollsActual);

		const [[line]] = await conn.query(
			'SELECT wol.*, wo.id AS wo_id, wo.so_number, wo.job_name FROM work_order_lines wol JOIN work_orders wo ON wo.id = wol.wo_id WHERE wol.id = ?',
			[run.wo_line_id]
		);

		const sqftActual = calcSqft(line, rollsActual);

		await conn.query(
			`INSERT INTO inventory_transactions
			 (sku_id, transaction_type, sqft_quantity, effective_date, reference_type, reference_id, memo, created_by)
			 VALUES (?, 'CONSUMPTION', ?, COALESCE(?, CURDATE()), 'PRODUCTION_RUN', ?, ?, ?)`,
			[
				run.sku_id,
				sqftActual,
				runDate || dateOnly(run.run_date),
				runId,
				`Run ${run.run_number} - ${line.so_number} ${line.job_name}`,
				userId ?? null,
			]
		);

		await conn.query(
			`UPDATE production_runs
			 SET rolls_actual = ?, sqft_actual = ?, run_date = COALESCE(?, run_date),
			     status = 'COMPLETED', confirmed_at = NOW(), confirmed_by = ?
			 WHERE id = ?`,
			[rollsActual, sqftActual, runDate || null, userId ?? null, runId]
		);

		await conn.query(
			'UPDATE work_order_lines SET rolls_produced = rolls_produced + ? WHERE id = ?',
			[rollsActual, run.wo_line_id]
		);

		const [[{ incomplete }]] = await conn.query(
			`SELECT COUNT(*) AS incomplete FROM work_order_lines WHERE wo_id = ? AND rolls_produced < qty`,
			[line.wo_id]
		);

		if (incomplete === 0) {
			await conn.query('UPDATE work_orders SET status = "COMPLETE" WHERE id = ?', [
				line.wo_id,
			]);
		}

		const shortfallRolls = run.rolls_scheduled - rollsActual;
		const shortfallRunNumber =
			shortfallRolls > 0
				? await insertShortfallRun(conn, run, line, shortfallRolls, userId)
				: null;

		await conn.commit();
		return { shortfallRunNumber, shortfallRolls: shortfallRolls > 0 ? shortfallRolls : null };
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

export async function unproduceRun(runId, rollsToUnproduce, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [[run]] = await conn.query(
			`SELECT pr.*, wol.wo_id, wo.so_number, wo.job_name, wo.status AS wo_status
			 FROM production_runs pr
			 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
			 JOIN work_orders wo ON wo.id = wol.wo_id
			 WHERE pr.id = ? FOR UPDATE`,
			[runId]
		);
		if (!run) throw new Error('Production run not found.');
		if (run.status !== 'COMPLETED') throw new Error('Only completed runs can be unproduced.');

		const line = await getLockedWoLine(conn, run.wo_line_id);

		const [[shipped]] = await conn.query(
			`SELECT COALESCE(SUM(rolls), 0) AS shippedRolls
			 FROM shipment_lines
			 WHERE production_run_id = ?`,
			[runId]
		);
		const shippedRolls = Number(shipped.shippedRolls);
		const unshippedRolls = Number(run.rolls_actual) - shippedRolls;
		validateUnproduceRolls(rollsToUnproduce, unshippedRolls);

		const [[consumption]] = await conn.query(
			`SELECT id, effective_date
			 FROM inventory_transactions
			 WHERE reference_type = 'PRODUCTION_RUN'
			   AND reference_id = ?
			   AND transaction_type = 'CONSUMPTION'
			 ORDER BY effective_date, id
			 LIMIT 1`,
			[runId]
		);
		if (!consumption) {
			throw new Error(
				`Run ${run.run_number} does not have a consumption transaction to reverse.`
			);
		}

		const sqftToUnproduce = prorateUnproduceSqft(line, run, rollsToUnproduce);
		await conn.query(
			`INSERT INTO inventory_transactions
			 (sku_id, transaction_type, sqft_quantity, effective_date, reference_type, reference_id,
			  reverses_transaction_id, memo, created_by)
			 VALUES (?, 'CONSUMPTION_REVERSAL', ?, ?, 'PRODUCTION_RUN', ?, ?, ?, ?)`,
			[
				run.sku_id,
				sqftToUnproduce,
				consumption.effective_date,
				runId,
				consumption.id,
				`Unproduced ${rollsToUnproduce} roll${rollsToUnproduce === 1 ? '' : 's'} from run ${run.run_number}`,
				userId ?? null,
			]
		);

		const fullUnproduce = rollsToUnproduce === Number(run.rolls_actual);
		let shortfallRunNumber = null;
		if (fullUnproduce) {
			const reopenedStatus = run.run_date ? 'SCHEDULED' : 'UNSCHEDULED';
			await conn.query(
				`UPDATE production_runs
				 SET status = ?, rolls_scheduled = ?, sqft_scheduled = ?,
				     rolls_actual = NULL, sqft_actual = NULL,
				     confirmed_at = NULL, confirmed_by = NULL
				 WHERE id = ?`,
				[reopenedStatus, run.rolls_actual, run.sqft_actual, runId]
			);
		} else {
			const remainingRolls = Number(run.rolls_actual) - rollsToUnproduce;
			const remainingSqft = Number(run.sqft_actual) - sqftToUnproduce;
			await conn.query(
				`UPDATE production_runs
				 SET rolls_actual = ?, sqft_actual = ?
				 WHERE id = ?`,
				[remainingRolls, remainingSqft, runId]
			);
			shortfallRunNumber = await insertShortfallRun(
				conn,
				run,
				line,
				rollsToUnproduce,
				userId,
				{
					runDate: dateOnly(run.run_date),
					groupId: run.group_id ?? null,
				}
			);
		}

		await conn.query(
			`UPDATE work_order_lines
			 SET rolls_produced = GREATEST(rolls_produced - ?, 0)
			 WHERE id = ?`,
			[rollsToUnproduce, run.wo_line_id]
		);

		await conn.query(
			`UPDATE work_orders
			 SET status = 'OPEN'
			 WHERE id = ? AND status = 'COMPLETE'`,
			[run.wo_id]
		);

		await conn.commit();
		return {
			woId: run.wo_id,
			shortfallRunNumber,
			rollsUnproduced: rollsToUnproduce,
			sqftUnproduced: sqftToUnproduce,
		};
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

export async function deleteRun(runId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();
		const [[run]] = await conn.query('SELECT * FROM production_runs WHERE id = ? FOR UPDATE', [
			runId,
		]);
		if (!run) throw new Error('Production run not found.');
		if (run.status === 'COMPLETED') throw new Error('Cannot delete a completed run.');
		await conn.query('DELETE FROM production_runs WHERE id = ?', [runId]);
		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

export const __productionTest = {
	calcSqft,
	dateOnly,
	prorateUnproduceSqft,
	validateRollsScheduled,
	validateConfirmableRun,
	validateUnproduceRolls,
};
