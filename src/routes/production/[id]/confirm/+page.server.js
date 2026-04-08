import { db } from '$lib/db.js';
import { confirmRun } from '$lib/services/production.js';
import { redirect, error, fail } from '@sveltejs/kit';

export async function load({ params }) {
	const [[run]] = await db.query(
		`SELECT pr.*, ms.display_label, so.so_number, so.job_name
		 FROM production_runs pr
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 JOIN sales_order_lines sol ON sol.id = pr.so_line_id
		 JOIN sales_orders so ON so.id = sol.so_id
		 WHERE pr.id = ?`,
		[params.id]
	);
	if (!run) error(404, 'Production run not found');
	return { run };
}

export const actions = {
	default: async ({ request, params, locals }) => {
		const data = await request.formData();
		const sqftActual = Math.round(Number(data.get('sqft_actual')));
		if (isNaN(sqftActual) || sqftActual <= 0)
			return fail(400, { error: 'Enter a valid sq ft value.' });

		try {
			await confirmRun(Number(params.id), sqftActual, locals.appUser?.id);
			redirect(303, '/production');
		} catch (err) {
			return fail(400, { error: err.message });
		}
	},
};
