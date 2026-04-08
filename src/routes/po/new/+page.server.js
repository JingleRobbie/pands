import { db } from '$lib/db.js';
import { redirect, fail } from '@sveltejs/kit';

export async function load() {
	const [skus] = await db.query('SELECT * FROM material_skus WHERE is_active = TRUE ORDER BY sort_order');
	return { skus };
}

export const actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const poNumber    = data.get('po_number')?.trim();
		const expectedDate = data.get('expected_date')?.trim();
		const skuIds  = data.getAll('sku_id');
		const sqfts   = data.getAll('sqft_ordered');

		if (!poNumber || !expectedDate) return fail(400, { error: 'PO number and expected date are required.' });

		const [[existing]] = await db.query('SELECT id FROM purchase_orders WHERE po_number = ?', [poNumber]);
		if (existing) return fail(400, { error: `PO number '${poNumber}' already exists.` });

		const lines = skuIds
			.map((sid, i) => ({ skuId: sid, sqft: Math.round(Number(sqfts[i])) }))
			.filter(l => l.skuId && l.sqft > 0);

		if (!lines.length) return fail(400, { error: 'Add at least one line item.' });

		const [result] = await db.query(
			'INSERT INTO purchase_orders (po_number, expected_date, created_by) VALUES (?, ?, ?)',
			[poNumber, expectedDate, locals.appUser?.id ?? null]
		);
		const poId = result.insertId;

		for (const l of lines) {
			await db.query(
				'INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered) VALUES (?, ?, ?)',
				[poId, l.skuId, l.sqft]
			);
		}

		redirect(303, `/po/${poId}`);
	},
};
