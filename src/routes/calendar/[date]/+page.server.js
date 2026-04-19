import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import { scheduleRun, deleteRun } from '$lib/services/production.js';
import { requireAdmin } from '$lib/auth.js';

export async function load({ params, locals }) {
	const { date } = params;

	const [runs] = await db.query(
		`SELECT pr.id, pr.run_number, pr.status, pr.rolls_scheduled, pr.rolls_actual,
		        ms.display_label AS sku_label, wol.facing,
		        wo.so_number, wo.customer_name, wo.job_name
		 FROM production_runs pr
		 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		 JOIN work_orders wo ON wo.id = wol.wo_id
		 JOIN material_skus ms ON ms.id = wol.sku_id
		 WHERE pr.run_date = ?
		 ORDER BY pr.run_number`,
		[date]
	);

	const [available] = await db.query(
		`SELECT wol.id, wol.qty, wol.rolls_produced,
		        ms.display_label AS sku_label, wol.facing,
		        wo.so_number, wo.customer_name, wo.job_name,
		        COALESCE(SUM(CASE WHEN pr.status != 'COMPLETED' THEN pr.rolls_scheduled ELSE 0 END), 0) AS rolls_in_runs
		 FROM work_order_lines wol
		 JOIN work_orders wo ON wo.id = wol.wo_id
		 JOIN material_skus ms ON ms.id = wol.sku_id
		 LEFT JOIN production_runs pr ON pr.wo_line_id = wol.id
		 WHERE wo.status NOT IN ('COMPLETE', 'CANCELLED')
		 GROUP BY wol.id
		 HAVING (wol.qty - wol.rolls_produced - rolls_in_runs) > 0
		 ORDER BY wo.so_number`,
		[]
	);

	return { date, runs, available, user: locals.appUser };
}

export const actions = {
	schedule: async ({ params, request, locals }) => {
		const { date } = params;
		const data = await request.formData();
		const woLineId = parseInt(data.get('wo_line_id'));
		const rolls = parseInt(data.get('rolls'));
		if (!rolls || rolls < 1) return fail(400, { error: 'Enter a valid roll count.' });
		try {
			await scheduleRun(woLineId, date, rolls, locals.appUser.id);
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
