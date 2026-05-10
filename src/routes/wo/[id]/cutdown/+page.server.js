import { db } from '$lib/db.js';
import { error, fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/auth.js';
import { scheduleCutDown, scheduleCutDownGroup, deleteCutDown } from '$lib/services/cutdown.js';

export async function load({ params }) {
	const [[wo]] = await db.query('SELECT * FROM work_orders WHERE id = ?', [params.id]);
	if (!wo) error(404, 'Work order not found');

	const [billingLines] = await db.query(
		`SELECT wol.*, ms.display_label, ms.r_value,
		        (SELECT COUNT(*) FROM work_order_lines c WHERE c.parent_line_id = wol.id) AS child_count
		 FROM work_order_lines wol
		 JOIN material_skus ms ON ms.id = wol.sku_id
		 WHERE wol.wo_id = ? AND wol.parent_line_id IS NULL
		 HAVING child_count > 0
		 ORDER BY wol.id`,
		[params.id]
	);

	const [productionLines] = await db.query(
		`SELECT wol.id, wol.parent_line_id, wol.width_in, wol.length_ft, wol.qty, wol.sqft
		 FROM work_order_lines wol
		 WHERE wol.wo_id = ? AND wol.parent_line_id IS NOT NULL
		 ORDER BY wol.id`,
		[params.id]
	);

	const [cutDowns] = await db.query(
		`SELECT cd.*, cdg.id AS group_id,
		        ms.display_label AS sku_label
		 FROM cut_downs cd
		 LEFT JOIN cut_down_groups cdg ON cdg.id = cd.group_id
		 JOIN material_skus ms ON ms.id = cd.sku_id
		 JOIN work_order_lines wol ON wol.id = cd.billing_line_id
		 WHERE wol.wo_id = ?
		 ORDER BY cd.run_date, cd.id`,
		[params.id]
	);

	const [rawRollLookups] = await db.query(
		'SELECT * FROM raw_roll_lookup ORDER BY thickness_in, width_in, vendor'
	);

	return { wo, billingLines, productionLines, cutDowns, rawRollLookups };
}

export const actions = {
	scheduleCutDown: async ({ request, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const billingLineId = parseInt(data.get('billingLineId'));
		const vendor = data.get('vendor') || 'JM';
		const runDate = data.get('runDate') || null;
		if (!billingLineId) return fail(400, { error: 'Billing line is required.' });
		try {
			await scheduleCutDown(billingLineId, vendor, runDate, locals.appUser.id);
		} catch (err) {
			return fail(400, { error: err.message });
		}
		return { success: true };
	},

	scheduleCutDownGroup: async ({ request, params, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const runDate = data.get('runDate') || null;
		const rawItems = data.get('items');
		let items; // expected: [{ billingLineId, vendor }]
		try {
			items = JSON.parse(rawItems);
		} catch {
			return fail(400, { error: 'Invalid items payload.' });
		}
		try {
			await scheduleCutDownGroup(parseInt(params.id), items, runDate, locals.appUser.id);
		} catch (err) {
			return fail(400, { error: err.message });
		}
		return { success: true };
	},

	deleteCutDown: async ({ request, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const cutDownId = parseInt(data.get('cutDownId'));
		if (!cutDownId) return fail(400, { error: 'Cut-down ID is required.' });
		try {
			await deleteCutDown(cutDownId);
		} catch (err) {
			return fail(400, { error: err.message });
		}
		return { success: true };
	},
};
