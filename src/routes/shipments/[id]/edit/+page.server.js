import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import { getShipment, updateShipment } from '$lib/services/shipping.js';

export async function load({ params }) {
	const shipment = await getShipment(params.id);
	if (!shipment) error(404, 'Shipment not found');
	if (shipment.status !== 'DRAFT') error(400, 'Only DRAFT shipments can be edited');

	// Available runs: COMPLETED, same WO, not on any shipment
	const [availableRuns] = await db.query(
		`SELECT pr.id, pr.run_date, pr.rolls_actual, pr.sqft_actual,
		        ms.display_label, wol.facing, wol.rollfor, wol.length_ft, wol.thickness_in, wol.width_in
		 FROM production_runs pr
		 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 WHERE wol.wo_id = ?
		   AND pr.status = 'COMPLETED'
		   AND pr.id NOT IN (SELECT production_run_id FROM shipment_lines)
		 ORDER BY pr.run_date, ms.display_label`,
		[shipment.wo_id]
	);

	return { shipment, availableRuns };
}

export const actions = {
	default: async ({ params, request, locals }) => {
		const data = await request.formData();

		const removeLineIds = data.getAll('remove_line').map(Number);

		const lineRolls = {};
		for (const [key, val] of data.entries()) {
			const m = key.match(/^line_rolls_(\d+)$/);
			if (m) {
				const v = parseInt(val);
				if (v > 0) lineRolls[parseInt(m[1])] = v;
			}
		}

		const shipDate = data.get('ship_date') || null;

		const addRunIds = data.getAll('add_run_ids').map(Number);
		const addRollsMap = {};
		for (const id of addRunIds) {
			const v = parseInt(data.get(`add_rolls_${id}`));
			if (v > 0) addRollsMap[id] = v;
		}

		try {
			await updateShipment(
				parseInt(params.id),
				{ removeLineIds, lineRolls, addRunIds, addRollsMap, shipDate },
				locals.appUser.id
			);
		} catch (err) {
			return fail(500, { error: err.message });
		}
		redirect(303, `/shipments/${params.id}`);
	},
};
