import { db } from '$lib/db.js';
import { confirmRun } from '$lib/services/production.js';
import { getMatrixDataForSkus } from '$lib/services/inventory.js';
import { safeReturnTo } from '$lib/navigation.js';
import { redirect, error, fail } from '@sveltejs/kit';

export async function load({ params }) {
	const [[run]] = await db.query(
		`SELECT pr.*, ms.display_label, wol.facing, wo.so_number, wo.job_name
		 FROM production_runs pr
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		 JOIN work_orders wo ON wo.id = wol.wo_id
		 WHERE pr.id = ?`,
		[params.id]
	);
	if (!run) error(404, 'Production run not found');
	const matrix = await getMatrixDataForSkus([run.sku_id]);
	return { run, matrix };
}

export const actions = {
	default: async ({ request, params, locals }) => {
		const data = await request.formData();
		const returnTo = safeReturnTo(data.get('return_to'), '/production');
		const rollsActual = parseInt(data.get('rolls_actual'));
		if (isNaN(rollsActual) || rollsActual <= 0)
			return fail(400, { error: 'Enter a valid roll count.' });

		try {
			await confirmRun(Number(params.id), rollsActual, locals.appUser?.id);
			redirect(303, returnTo);
		} catch (err) {
			return fail(400, { error: err.message });
		}
	},
};
