import { db } from '$lib/db.js';
import { scheduleRun } from '$lib/services/production.js';
import { redirect, fail } from '@sveltejs/kit';

export async function load({ url }) {
	const [sos] = await db.query(
		`SELECT so.id, so.so_number, so.job_name, so.ship_date
		 FROM sales_orders so
		 WHERE so.status IN ('OPEN','IN_PROGRESS')
		 ORDER BY so.ship_date`
	);

	// Load lines per SO (with unscheduled sqft)
	const soLines = {};
	for (const so of sos) {
		const [lines] = await db.query(
			`SELECT sol.id, sol.sku_id, sol.sqft_ordered, sol.sqft_produced,
			        ms.display_label,
			        COALESCE((SELECT SUM(sqft_scheduled) FROM production_runs
			                  WHERE so_line_id = sol.id AND status != 'CONFIRMED'), 0) AS sqft_scheduled
			 FROM sales_order_lines sol
			 JOIN material_skus ms ON ms.id = sol.sku_id
			 WHERE sol.so_id = ?`, [so.id]
		);
		soLines[so.id] = lines
			.map(l => ({
				...l,
				sqftUnscheduled: Math.max(Number(l.sqft_ordered) - Number(l.sqft_produced) - Number(l.sqft_scheduled), 0)
			}))
			.filter(l => l.sqftUnscheduled > 0.01);
	}

	return { sos, soLines, preselectSo: url.searchParams.get('so') };
}

export const actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const soLineId     = data.get('so_line_id');
		const runDate      = data.get('run_date')?.trim() || null;
		const sqftScheduled = Math.round(Number(data.get('sqft_scheduled')));

		if (!soLineId || isNaN(sqftScheduled)) return fail(400, { error: 'SO line and sq ft are required.' });

		try {
			await scheduleRun(Number(soLineId), runDate, sqftScheduled, locals.appUser?.id);
			redirect(303, '/production');
		} catch (err) {
			return fail(400, { error: err.message });
		}
	},
};
