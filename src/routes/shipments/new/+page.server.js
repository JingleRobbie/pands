import { fail, redirect, error } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import { createShipment } from '$lib/services/shipping.js';

export async function load({ url }) {
	const woId = parseInt(url.searchParams.get('wo'));
	if (!woId) error(400, 'Work order ID required');

	const [[wo]] = await db.query(
		`SELECT wo.*, c.name AS customer_display_name
		 FROM work_orders wo
		 LEFT JOIN customers c ON c.id = wo.customer_id
		 WHERE wo.id = ?`,
		[woId]
	);
	if (!wo) error(404, 'Work order not found');
	if (!wo.customer_id) error(400, 'Work order must be linked to a customer before shipping');

	// COMPLETED production runs not already on any shipment
	const [runs] = await db.query(
		`SELECT pr.id, pr.run_date, pr.rolls_actual, pr.sqft_actual,
		        ms.display_label, ms.pebs, wol.facing, wol.rollfor, wol.length_ft, wol.thickness_in, wol.width_in
		 FROM production_runs pr
		 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 WHERE wol.wo_id = ?
		   AND pr.status = 'COMPLETED'
		   AND pr.id NOT IN (SELECT production_run_id FROM shipment_lines WHERE production_run_id IS NOT NULL)
		 ORDER BY pr.run_date, ms.display_label`,
		[woId]
	);

	// COMPLETED cut-downs not already on a shipment (CUT_SHIP path)
	const [cutDowns] = await db.query(
		`SELECT cd.id, cd.sqft_actual, cd.run_date, ms.display_label, ms.pebs, wol.width_in
		 FROM cut_downs cd
		 JOIN material_skus ms ON ms.id = cd.sku_id
		 JOIN work_order_lines wol ON wol.id = cd.billing_line_id
		 WHERE cd.wo_id = ? AND cd.status = 'COMPLETED'
		   AND cd.id NOT IN (SELECT cut_down_id FROM shipment_lines WHERE cut_down_id IS NOT NULL)`,
		[woId]
	);

	// Unbranched WO lines not already on a shipment (DIRECT_SHIP path)
	const [directLines] = await db.query(
		`SELECT wol.id, wol.sqft, wol.width_in, wol.length_ft, ms.display_label, ms.pebs
		 FROM work_order_lines wol
		 JOIN material_skus ms ON ms.id = wol.sku_id
		 WHERE wol.wo_id = ? AND wol.parent_line_id IS NULL
		   AND NOT EXISTS (SELECT 1 FROM work_order_lines c WHERE c.parent_line_id = wol.id)
		   AND wol.id NOT IN (SELECT wo_line_id FROM shipment_lines WHERE wo_line_id IS NOT NULL)`,
		[woId]
	);

	return { wo, runs, cutDowns, directLines };
}

export const actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const woId = parseInt(data.get('wo_id'));
		const customerId = parseInt(data.get('customer_id'));
		const shipDate = data.get('ship_date');
		const runIds = data.getAll('run_ids').map(Number);
		const cutDownIds = data.getAll('cut_down_ids').map(Number);
		const woLineIds = data.getAll('wo_line_ids').map(Number);

		if (!shipDate) return fail(400, { error: 'Ship date is required.' });
		if (runIds.length + cutDownIds.length + woLineIds.length === 0)
			return fail(400, { error: 'Select at least one source.' });

		const sources = [
			...runIds.map((id) => ({ type: 'PRODUCTION_RUN', id })),
			...cutDownIds.map((id) => ({ type: 'CUT_DOWN', id })),
			...woLineIds.map((id) => ({ type: 'WO_LINE', id })),
		];

		const rollsMap = {};
		for (const id of runIds) {
			const v = parseInt(data.get(`rolls_to_ship_${id}`));
			if (v > 0) rollsMap[id] = v;
		}

		let shipmentId;
		try {
			({ shipmentId } = await createShipment(
				woId,
				customerId,
				shipDate,
				sources,
				locals.appUser.id,
				rollsMap
			));
		} catch (err) {
			return fail(500, { error: err.message });
		}
		redirect(303, `/wo/${woId}?shipment_created=${shipmentId}`);
	},
};
