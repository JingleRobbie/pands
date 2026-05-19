import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import { createNPO } from '$lib/services/npo.js';

export async function load() {
	const [customers] = await db.query(
		'SELECT id, name FROM customers ORDER BY name'
	);
	const [skus] = await db.query(
		'SELECT id, sku_code, thickness_in, width_in, display_label, pebs FROM material_skus WHERE is_active = TRUE ORDER BY sort_order'
	);
	return { customers, skus };
}

export const actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();

		const soNumber = (data.get('so_number') ?? '').trim();
		const customerId = parseInt(data.get('customer_id'));
		const jobName = (data.get('job_name') ?? '').trim();
		const shipDate = (data.get('ship_date') ?? '').trim() || null;
		const shipAsap = data.get('ship_asap') === 'on';

		if (!soNumber) return fail(400, { error: 'SO number is required.' });
		if (!customerId) return fail(400, { error: 'Customer is required.' });
		if (!jobName) return fail(400, { error: 'Job name is required.' });

		const skuIds = data.getAll('sku_id');
		const qtys = data.getAll('qty');
		const lengthFts = data.getAll('length_ft');
		const skuWidths = data.getAll('sku_width');
		const skuThicknesses = data.getAll('sku_thickness');
		const sqfts = data.getAll('sqft');

		if (skuIds.length === 0) return fail(400, { error: 'At least one line is required.' });

		const lines = [];
		for (let i = 0; i < skuIds.length; i++) {
			const skuId = parseInt(skuIds[i]);
			const qty = parseInt(qtys[i]);
			const lengthFt = parseFloat(lengthFts[i]);
			const widthIn = parseInt(skuWidths[i]);
			const thicknessIn = parseFloat(skuThicknesses[i]);
			const sqft = parseInt(sqfts[i]);

			if (!skuId) return fail(400, { error: `Line ${i + 1}: SKU is required.` });
			if (!qty || qty < 1) return fail(400, { error: `Line ${i + 1}: quantity must be at least 1.` });
			if (!lengthFt || lengthFt <= 0) return fail(400, { error: `Line ${i + 1}: length must be greater than 0.` });

			lines.push({ skuId, thicknessIn, widthIn, qty, lengthFt, sqft });
		}

		let woId;
		try {
			({ woId } = await createNPO(
				{ soNumber, customerId, jobName, shipDate, shipAsap, lines },
				locals.appUser.id
			));
		} catch (err) {
			return fail(500, { error: err.message });
		}
		redirect(303, `/npo/${woId}`);
	},
};
