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

	// COMPLETED runs for this WO not already on any shipment
	const [runs] = await db.query(
		`SELECT pr.id, pr.run_date, pr.rolls_actual, pr.sqft_actual,
		        ms.display_label, wol.facing, wol.rollfor, wol.length_ft, wol.thickness_in, wol.width_in
		 FROM production_runs pr
		 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 WHERE wol.wo_id = ?
		   AND pr.status = 'COMPLETED'
		   AND pr.id NOT IN (SELECT production_run_id FROM shipment_lines)
		 ORDER BY pr.run_date, ms.display_label`,
		[woId]
	);

	return { wo, runs };
}

export const actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const woId = parseInt(data.get('wo_id'));
		const customerId = parseInt(data.get('customer_id'));
		const shipDate = data.get('ship_date');
		const runIds = data.getAll('run_ids').map(Number);

		if (!shipDate) return fail(400, { error: 'Ship date is required.' });
		if (runIds.length === 0) return fail(400, { error: 'Select at least one production run.' });

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
				runIds,
				locals.appUser.id,
				rollsMap
			));
		} catch (err) {
			return fail(500, { error: err.message });
		}
		redirect(303, `/wo/${woId}?shipment_created=${shipmentId}`);
	},
};
