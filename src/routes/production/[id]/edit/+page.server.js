import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';

export async function load({ params }) {
	const [[run]] = await db.query(
		`SELECT pr.*, ms.display_label, so.so_number, so.job_name, sol.sqft_ordered, sol.sqft_produced
		 FROM production_runs pr
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 JOIN sales_order_lines sol ON sol.id = pr.so_line_id
		 JOIN sales_orders so ON so.id = sol.so_id
		 WHERE pr.id = ?`,
		[params.id]
	);
	if (!run) error(404, 'Production run not found');
	if (run.status === 'CONFIRMED') error(400, 'Confirmed runs cannot be edited');

	// Max sqft = unscheduled sqft for the SO line + this run's current sqft_scheduled
	const [[{ otherScheduled }]] = await db.query(
		`SELECT COALESCE(SUM(sqft_scheduled), 0) AS otherScheduled
		 FROM production_runs
		 WHERE so_line_id = ? AND id != ? AND status != 'CONFIRMED'`,
		[run.so_line_id, params.id]
	);
	const maxSqft = Number(run.sqft_ordered) - Number(run.sqft_produced) - Number(otherScheduled);

	return { run, maxSqft };
}

export const actions = {
	default: async ({ request, params }) => {
		const data = await request.formData();
		const runDate = data.get('run_date')?.trim() || null;
		const sqftScheduled = Math.round(Number(data.get('sqft_scheduled')));

		if (isNaN(sqftScheduled) || sqftScheduled < 1)
			return fail(400, { error: 'Scheduled sq ft must be at least 1.' });

		const conn = await db.getConnection();
		try {
			await conn.beginTransaction();

			const [[run]] = await conn.query(
				'SELECT * FROM production_runs WHERE id = ? FOR UPDATE',
				[params.id]
			);
			if (!run) return fail(404, { error: 'Run not found.' });
			if (run.status === 'CONFIRMED')
				return fail(400, { error: 'Confirmed runs cannot be edited.' });

			// Re-validate sqft against current SO line totals
			const [[sol]] = await conn.query('SELECT * FROM sales_order_lines WHERE id = ?', [
				run.so_line_id,
			]);
			const [[{ otherScheduled }]] = await conn.query(
				`SELECT COALESCE(SUM(sqft_scheduled), 0) AS otherScheduled
				 FROM production_runs
				 WHERE so_line_id = ? AND id != ? AND status != 'CONFIRMED'`,
				[run.so_line_id, params.id]
			);
			const maxSqft =
				Number(sol.sqft_ordered) - Number(sol.sqft_produced) - Number(otherScheduled);

			if (sqftScheduled > maxSqft)
				return fail(400, {
					error: `Cannot schedule ${sqftScheduled} sqft — only ${maxSqft} sqft available.`,
				});

			const newStatus = runDate ? 'SCHEDULED' : 'UNSCHEDULED';
			await conn.query(
				'UPDATE production_runs SET run_date = ?, sqft_scheduled = ?, status = ? WHERE id = ?',
				[runDate, sqftScheduled, newStatus, params.id]
			);

			await conn.commit();
		} catch (err) {
			await conn.rollback();
			return fail(500, { error: err.message });
		} finally {
			conn.release();
		}

		redirect(303, `/production/${params.id}/confirm`);
	},
};
