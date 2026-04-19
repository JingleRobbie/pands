import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import { upsertScheduledRun, deleteRun } from '$lib/services/production.js';
import { requireAdmin } from '$lib/auth.js';

export async function load({ params, locals }) {
	const { date } = params;

	const [runs] = await db.query(
		`SELECT pr.id, pr.run_number, pr.status, pr.sqft_scheduled, pr.sqft_actual,
		        ms.display_label AS sku_label,
		        so.so_number, so.customer_name, so.job_name
		 FROM production_runs pr
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 JOIN sales_order_lines sol ON sol.id = pr.so_line_id
		 JOIN sales_orders so ON so.id = sol.so_id
		 WHERE pr.run_date = ?
		 ORDER BY pr.run_number`,
		[date]
	);

	const [available] = await db.query(
		`SELECT sol.id, sol.sqft_ordered, sol.sqft_produced,
		        ms.display_label AS sku_label,
		        so.so_number, so.customer_name, so.job_name,
		        COALESCE(SUM(CASE WHEN pr.status != 'COMPLETED' THEN pr.sqft_scheduled ELSE 0 END), 0) AS sqft_in_runs
		 FROM sales_order_lines sol
		 JOIN sales_orders so ON so.id = sol.so_id
		 JOIN material_skus ms ON ms.id = sol.sku_id
		 LEFT JOIN production_runs pr ON pr.so_line_id = sol.id
		 WHERE so.status NOT IN ('COMPLETE')
		 GROUP BY sol.id
		 HAVING (sol.sqft_ordered - sol.sqft_produced - sqft_in_runs) > 0
		 ORDER BY so.so_number, ms.sort_order`,
		[]
	);

	return { date, runs, available, user: locals.appUser };
}

export const actions = {
	schedule: async ({ params, request, locals }) => {
		const { date } = params;
		const data = await request.formData();
		const soLineId = parseInt(data.get('so_line_id'));
		const sqft = parseInt(data.get('sqft'));
		if (!sqft || sqft < 1) return fail(400, { error: 'Enter a valid sqft amount.' });
		try {
			await upsertScheduledRun(soLineId, date, sqft, locals.appUser.id);
		} catch (err) {
			return fail(500, { error: err.message });
		}
		redirect(303, `/calendar/${date}`);
	},

	delete: async ({ params, request, locals }) => {
		const denied = requireAdmin(locals);
		if (denied) return denied;
		const { date } = params;
		const data = await request.formData();
		const runId = parseInt(data.get('run_id'));
		try {
			await deleteRun(runId);
		} catch (err) {
			return fail(500, { error: err.message });
		}
		redirect(303, `/calendar/${date}`);
	},
};
