import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { confirmRun } from '$lib/services/production.js';
import { getMatrixDataForSkus } from '$lib/services/inventory.js';

export async function load({ params }) {
	const [[so]] = await db.query('SELECT * FROM sales_orders WHERE id = ?', [params.id]);
	if (!so) error(404, 'SO not found');

	const [runs] = await db.query(
		`SELECT pr.*, ms.display_label AS sku_label
		 FROM production_runs pr
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 JOIN sales_order_lines sol ON sol.id = pr.so_line_id
		 WHERE sol.so_id = ?
		 ORDER BY pr.run_date, pr.run_number`,
		[params.id]
	);

	const skuIds = [...new Set(runs.map((r) => r.sku_id))];
	const matrix = skuIds.length ? await getMatrixDataForSkus(skuIds) : null;

	return { so, runs, matrix };
}

export const actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const runIds = data.getAll('run_id').map(Number);

		if (runIds.length === 0) return fail(400, { error: 'No runs to confirm.' });

		for (const runId of runIds) {
			const sqft = Math.round(Number(data.get(`sqft_${runId}`)));
			if (isNaN(sqft) || sqft <= 0)
				return fail(400, { error: 'Enter a valid sq ft value for all runs.' });
			try {
				await confirmRun(runId, sqft, locals.appUser?.id);
			} catch (err) {
				return fail(400, { error: err.message });
			}
		}

		redirect(303, '/production');
	},
};
