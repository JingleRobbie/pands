import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

function todayStr() {
	return localDate();
}

async function nextRunNumber() {
	const prefix = `PR-${todayStr().replace(/-/g, '')}-`;
	const [[{ last }]] = await db.query(
		'SELECT MAX(run_number) AS last FROM production_runs WHERE run_number LIKE ?',
		[`${prefix}%`]
	);
	const seq = last ? parseInt(last.slice(-3)) + 1 : 1;
	return `${prefix}${String(seq).padStart(3, '0')}`;
}

export async function scheduleRun(soLineId, runDate, sqftScheduled, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [[line]] = await conn.query(
			'SELECT * FROM sales_order_lines WHERE id = ? FOR UPDATE',
			[soLineId]
		);
		if (!line) throw new Error('SO line not found.');

		// Calc unscheduled sqft
		const [[{ sqftInRuns }]] = await conn.query(
			`
			SELECT COALESCE(SUM(sqft_scheduled), 0) AS sqftInRuns
			FROM production_runs
			WHERE so_line_id = ? AND status != 'CONFIRMED'
		`,
			[soLineId]
		);

		const unscheduled =
			Number(line.sqft_ordered) - Number(line.sqft_produced) - Number(sqftInRuns);
		if (sqftScheduled <= 0) throw new Error('Scheduled sq ft must be greater than zero.');
		if (sqftScheduled > unscheduled) {
			throw new Error(
				`Cannot schedule ${sqftScheduled} sqft — only ${unscheduled.toFixed(0)} sqft unscheduled.`
			);
		}

		const runNumber = await nextRunNumber();
		const status = runDate ? 'SCHEDULED' : 'UNSCHEDULED';

		await conn.query(
			`
			INSERT INTO production_runs (run_number, so_line_id, sku_id, run_date, sqft_scheduled, status, created_by)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`,
			[
				runNumber,
				soLineId,
				line.sku_id,
				runDate || null,
				sqftScheduled,
				status,
				userId ?? null,
			]
		);

		// Advance SO status to IN_PROGRESS if still OPEN
		await conn.query(
			'UPDATE sales_orders SET status = "IN_PROGRESS" WHERE id = ? AND status = "OPEN"',
			[line.so_id]
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

export async function confirmRun(runId, sqftActual, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [[run]] = await conn.query('SELECT * FROM production_runs WHERE id = ? FOR UPDATE', [
			runId,
		]);
		if (!run) throw new Error('Production run not found.');
		if (run.status === 'CONFIRMED') throw new Error('This run is already confirmed.');

		// Create CONSUMPTION transaction
		const [[sol]] = await conn.query('SELECT * FROM sales_order_lines WHERE id = ?', [
			run.so_line_id,
		]);
		const [[so]] = await conn.query('SELECT * FROM sales_orders WHERE id = ?', [sol.so_id]);

		await conn.query(
			`
			INSERT INTO inventory_transactions (sku_id, transaction_type, sqft_quantity, reference_type, reference_id, memo, created_by)
			VALUES (?, 'CONSUMPTION', ?, 'PRODUCTION_RUN', ?, ?, ?)
		`,
			[
				run.sku_id,
				sqftActual,
				runId,
				`Run ${run.run_number} — ${so.so_number} ${so.job_name}`,
				userId ?? null,
			]
		);

		// Mark run confirmed
		await conn.query(
			`
			UPDATE production_runs
			SET sqft_actual = ?, status = 'CONFIRMED', confirmed_at = NOW(), confirmed_by = ?
			WHERE id = ?
		`,
			[sqftActual, userId ?? null, runId]
		);

		// Update SO line sqft_produced
		await conn.query(
			'UPDATE sales_order_lines SET sqft_produced = sqft_produced + ? WHERE id = ?',
			[sqftActual, run.so_line_id]
		);

		// Check if SO is fully complete
		const [[{ incomplete }]] = await conn.query(
			`
			SELECT COUNT(*) AS incomplete
			FROM sales_order_lines
			WHERE so_id = ? AND sqft_produced < sqft_ordered
		`,
			[sol.so_id]
		);

		if (incomplete === 0) {
			await conn.query('UPDATE sales_orders SET status = "COMPLETE" WHERE id = ?', [
				sol.so_id,
			]);
		}

		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}
