import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import { addNPOLine, removeNPOLine } from '$lib/services/npo.js';

export async function load({ params, locals }) {
	const woId = parseInt(params.id);

	const [[wo]] = await db.query(
		`SELECT wo.*, c.name AS customer_display_name
		 FROM work_orders wo
		 LEFT JOIN customers c ON c.id = wo.customer_id
		 WHERE wo.id = ? AND wo.order_type = 'NON_PRODUCTION'`,
		[woId]
	);
	if (!wo) error(404, 'Non-production order not found');

	const [lines] = await db.query(
		`SELECT wol.id, wol.sku_id, wol.qty, wol.length_ft, wol.sqft,
		        ms.display_label, ms.pebs,
		        sl.id AS shipment_line_id,
		        s.id AS shipment_id,
		        s.shipment_number,
		        s.status AS shipment_status
		 FROM work_order_lines wol
		 JOIN material_skus ms ON ms.id = wol.sku_id
		 LEFT JOIN shipment_lines sl ON sl.wo_line_id = wol.id
		 LEFT JOIN shipments s ON s.id = sl.shipment_id
		 WHERE wol.wo_id = ?
		 ORDER BY wol.id`,
		[woId]
	);

	const [shipments] = await db.query(
		`SELECT s.id, s.shipment_number, s.ship_date, s.status,
		        COUNT(sl.id) AS line_count,
		        COALESCE(SUM(sl.sqft), 0) AS total_sqft
		 FROM shipments s
		 LEFT JOIN shipment_lines sl ON sl.shipment_id = s.id
		 WHERE s.wo_id = ?
		 GROUP BY s.id
		 ORDER BY s.id DESC`,
		[woId]
	);

	const [skus] = await db.query(
		'SELECT id, sku_code, thickness_in, width_in, display_label, pebs FROM material_skus WHERE is_active = TRUE ORDER BY sort_order'
	);

	const unshippedCount = lines.filter((l) => !l.shipment_line_id).length;

	return { wo, lines, shipments, skus, unshippedCount, user: locals.appUser };
}

export const actions = {
	addLine: async ({ params, request, locals }) => {
		const woId = parseInt(params.id);
		const data = await request.formData();

		const [[wo]] = await db.query(
			"SELECT status FROM work_orders WHERE id = ? AND order_type = 'NON_PRODUCTION'",
			[woId]
		);
		if (!wo) return fail(404, { addError: 'NPO not found.' });
		if (wo.status !== 'OPEN') return fail(400, { addError: 'Cannot add lines to a completed NPO.' });

		const skuId = parseInt(data.get('sku_id'));
		const qty = parseInt(data.get('qty'));
		const lengthFt = parseFloat(data.get('length_ft'));

		if (!skuId) return fail(400, { addError: 'SKU is required.' });
		if (!qty || qty < 1) return fail(400, { addError: 'Quantity must be at least 1.' });
		if (!lengthFt || lengthFt <= 0) return fail(400, { addError: 'Length must be greater than 0.' });

		const [[sku]] = await db.query(
			'SELECT id, thickness_in, width_in FROM material_skus WHERE id = ? AND is_active = TRUE',
			[skuId]
		);
		if (!sku) return fail(400, { addError: 'Invalid SKU.' });

		const sqft = Math.round(qty * (sku.width_in / 12) * lengthFt);

		try {
			await addNPOLine(woId, {
				skuId: sku.id,
				thicknessIn: sku.thickness_in,
				widthIn: sku.width_in,
				qty,
				lengthFt,
				sqft,
			});
		} catch (err) {
			return fail(500, { addError: err.message });
		}
		return {};
	},

	removeLine: async ({ params, request }) => {
		const woId = parseInt(params.id);
		const data = await request.formData();
		const lineId = parseInt(data.get('line_id'));
		if (!lineId) return fail(400, { removeError: 'Line ID required.' });

		try {
			await removeNPOLine(woId, lineId);
		} catch (err) {
			return fail(400, { removeError: err.message });
		}
		return {};
	},
};
