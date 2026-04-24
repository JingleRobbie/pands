import { db } from '$lib/db.js';
import { error, fail } from '@sveltejs/kit';
import { confirmRun, deleteRun } from '$lib/services/production.js';
import { getMatrixDataForSkus } from '$lib/services/inventory.js';
import { requireAdmin } from '$lib/auth.js';

export async function load({ params, locals }) {
	const [[wo]] = await db.query('SELECT * FROM work_orders WHERE id = ?', [params.id]);
	if (!wo) error(404, 'Work order not found');

	const [runs] = await db.query(
		`SELECT pr.*, ms.display_label AS sku_label, wol.facing, wol.length_ft, wol.width_in, wol.thickness_in, wol.rollfor
		 FROM production_runs pr
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		 WHERE wol.wo_id = ?
		 ORDER BY pr.group_id IS NULL, pr.group_id, pr.run_date, pr.run_number`,
		[params.id]
	);

	const skuIds = [...new Set(runs.map((r) => r.sku_id))];
	const matrix = skuIds.length ? await getMatrixDataForSkus(skuIds) : null;

	return { wo, runs, matrix, user: locals.appUser };
}

export const actions = {
	confirm: async ({ request, locals }) => {
		const denied = requireAdmin(locals);
		if (denied) return denied;
		const data = await request.formData();
		const runIds = data.getAll('run_id').map(Number);

		if (runIds.length === 0) return fail(400, { error: 'No runs to confirm.' });

		const shortfalls = [];
		for (const runId of runIds) {
			const rolls = parseInt(data.get(`rolls_${runId}`));
			if (isNaN(rolls) || rolls <= 0)
				return fail(400, { error: 'Enter a valid roll count for all runs.' });
			const runDate = data.get(`date_${runId}`) || null;
			try {
				const result = await confirmRun(runId, rolls, locals.appUser?.id, runDate);
				if (result?.shortfallRunNumber) {
					shortfalls.push({
						runNumber: result.shortfallRunNumber,
						rolls: result.shortfallRolls,
					});
				}
			} catch (err) {
				return fail(400, { error: err.message });
			}
		}

		return { success: true, confirmed: runIds.length, shortfalls };
	},

	remove: async ({ request, locals }) => {
		const denied = requireAdmin(locals);
		if (denied) return denied;
		const data = await request.formData();
		const runId = Number(data.get('run_id'));
		if (!runId) return fail(400, { error: 'No run specified.' });
		try {
			await deleteRun(runId);
		} catch (err) {
			return fail(400, { error: err.message });
		}
		return { deleted: true };
	},
};
