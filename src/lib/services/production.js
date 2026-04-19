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

export async function scheduleRun(woLineId, runDate, rollsScheduled, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [[wol]] = await conn.query('SELECT * FROM work_order_lines WHERE id = ? FOR UPDATE', [
			woLineId,
		]);
		if (!wol) throw new Error('WO line not found.');

		const [[{ rollsInRuns }]] = await conn.query(
			`SELECT COALESCE(SUM(rolls_scheduled), 0) AS rollsInRuns
			 FROM production_runs WHERE wo_line_id = ? AND status != 'COMPLETED'`,
			[woLineId]
		);

		const remaining = Number(wol.qty) - Number(wol.rolls_produced) - Number(rollsInRuns);
		if (rollsScheduled <= 0) throw new Error('Rolls scheduled must be greater than zero.');
		if (rollsScheduled > remaining) {
			throw new Error(
				`Cannot schedule ${rollsScheduled} rolls — only ${remaining} rolls remaining.`
			);
		}

		const sqftScheduled = Math.round(
			rollsScheduled * (Number(wol.width_in) / 12) * Number(wol.length_ft)
		);
		const runNumber = await nextRunNumber(conn);
		const status = runDate ? 'SCHEDULED' : 'UNSCHEDULED';

		await conn.query(
			`INSERT INTO production_runs (run_number, wo_line_id, sku_id, run_date, rolls_scheduled, sqft_scheduled, status, created_by)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				runNumber,
				woLineId,
				wol.sku_id,
				runDate || null,
				rollsScheduled,
				sqftScheduled,
				status,
				userId ?? null,
			]
		);

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

		const [{ insertId: groupId }] = await conn.query(
			'INSERT INTO production_run_groups (created_by) VALUES (?)',
			[userId ?? null]
		);

		for (const { woLineId, rollsScheduled } of items) {
			const [[wol]] = await conn.query(
				'SELECT * FROM work_order_lines WHERE id = ? FOR UPDATE',
				[woLineId]
			);
			if (!wol) throw new Error(`WO line ${woLineId} not found.`);

			const [[{ rollsInRuns }]] = await conn.query(
				`SELECT COALESCE(SUM(rolls_scheduled), 0) AS rollsInRuns
				 FROM production_runs WHERE wo_line_id = ? AND status != 'COMPLETED'`,
				[woLineId]
			);

			const remaining = Number(wol.qty) - Number(wol.rolls_produced) - Number(rollsInRuns);
			if (rollsScheduled <= 0) throw new Error('Rolls scheduled must be greater than zero.');
			if (rollsScheduled > remaining) {
				throw new Error(
					`Cannot schedule ${rollsScheduled} rolls for line ${woLineId} — only ${remaining} remaining.`
				);
			}

			const sqftScheduled = Math.round(
				rollsScheduled * (Number(wol.width_in) / 12) * Number(wol.length_ft)
			);
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
					wol.sku_id,
					runDate || null,
					rollsScheduled,
					sqftScheduled,
					status,
					userId ?? null,
				]
			);
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
		if (!run) throw new Error('Production run not found.');
		if (run.status === 'COMPLETED') throw new Error('This run is already completed.');
		if (rollsActual > run.rolls_scheduled)
			throw new Error(
				`Cannot record ${rollsActual} rolls — only ${run.rolls_scheduled} rolls were scheduled.`
			);

		const [[wol]] = await conn.query(
			'SELECT wol.*, wo.id AS wo_id, wo.so_number, wo.job_name FROM work_order_lines wol JOIN work_orders wo ON wo.id = wol.wo_id WHERE wol.id = ?',
			[run.wo_line_id]
		);

		const sqftActual = Math.round(
			rollsActual * (Number(wol.width_in) / 12) * Number(wol.length_ft)
		);

		await conn.query(
			`INSERT INTO inventory_transactions (sku_id, transaction_type, sqft_quantity, reference_type, reference_id, memo, created_by)
			 VALUES (?, 'CONSUMPTION', ?, 'PRODUCTION_RUN', ?, ?, ?)`,
			[
				run.sku_id,
				sqftActual,
				runId,
				`Run ${run.run_number} — ${wol.so_number} ${wol.job_name}`,
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
			[wol.wo_id]
		);

		if (incomplete === 0) {
			await conn.query('UPDATE work_orders SET status = "COMPLETE" WHERE id = ?', [
				wol.wo_id,
			]);
		}

		const shortfallRolls = run.rolls_scheduled - rollsActual;
		let shortfallRunNumber = null;
		if (shortfallRolls > 0) {
			shortfallRunNumber = await nextRunNumber(conn);
			const shortfallSqft = Math.round(
				shortfallRolls * (Number(wol.width_in) / 12) * Number(wol.length_ft)
			);
			await conn.query(
				`INSERT INTO production_runs (run_number, wo_line_id, sku_id, run_date, rolls_scheduled, sqft_scheduled, status, created_by)
				 VALUES (?, ?, ?, NULL, ?, ?, 'UNSCHEDULED', ?)`,
				[
					shortfallRunNumber,
					run.wo_line_id,
					run.sku_id,
					shortfallRolls,
					shortfallSqft,
					userId ?? null,
				]
			);
		}

		await conn.commit();
		return { shortfallRunNumber, shortfallRolls: shortfallRolls > 0 ? shortfallRolls : null };
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
