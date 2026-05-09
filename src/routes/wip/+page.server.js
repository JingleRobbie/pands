import { db } from '$lib/db.js';
import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/auth.js';
import { assignScrap } from '$lib/services/cutdown.js';

export async function load() {
	// WIP balances per cut-down with WO context — only show positive balance by default
	const [wipBalances] = await db.query(
		`SELECT cd.id AS cut_down_id,
		        wo.so_number, wo.job_name,
		        wl.width_in,
		        SUM(wl.sqft_quantity) AS balance,
		        cd.status AS cut_down_status,
		        cd.confirmed_at
		 FROM wip_ledger wl
		 JOIN cut_downs cd ON cd.id = wl.cut_down_id
		 JOIN work_orders wo ON wo.id = cd.wo_id
		 GROUP BY cd.id, wo.so_number, wo.job_name, wl.width_in, cd.status, cd.confirmed_at
		 HAVING SUM(wl.sqft_quantity) > 0
		 ORDER BY cd.confirmed_at DESC, wo.so_number`
	);

	// All production lines across all WOs (for assignment target selector)
	const [productionLines] = await db.query(
		`SELECT wol.id, wol.width_in, wol.qty, wol.length_ft, wol.sqft,
		        wo.so_number, wo.job_name, wo.id AS wo_id
		 FROM work_order_lines wol
		 JOIN work_orders wo ON wo.id = wol.wo_id
		 WHERE wol.parent_line_id IS NOT NULL
		   AND wo.status = 'OPEN'
		 ORDER BY wo.so_number, wol.id`
	);

	return { wipBalances, productionLines };
}

export const actions = {
	assignScrap: async ({ request, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const sourceCutDownId = parseInt(data.get('sourceCutDownId'));
		const destinationWoLineId = parseInt(data.get('destinationWoLineId'));
		const sqftToAssign = parseInt(data.get('sqftToAssign'));

		if (!sourceCutDownId || !destinationWoLineId || !sqftToAssign || sqftToAssign < 1)
			return fail(400, { error: 'All fields required.' });

		try {
			await assignScrap(
				sourceCutDownId,
				destinationWoLineId,
				sqftToAssign,
				locals.appUser.id
			);
		} catch (err) {
			return fail(400, { error: err.message });
		}
		return { success: true };
	},
};
