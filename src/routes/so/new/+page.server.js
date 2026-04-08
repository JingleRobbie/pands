import { db } from '$lib/db.js';
import { redirect, fail } from '@sveltejs/kit';

export async function load() {
	const [skus] = await db.query('SELECT * FROM material_skus WHERE is_active = TRUE ORDER BY sort_order');
	return { skus };
}

export const actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const soNumber = data.get('so_number')?.trim();
		const jobName  = data.get('job_name')?.trim();
		const shipDate = data.get('ship_date')?.trim();
		const skuIds   = data.getAll('sku_id');
		const sqfts    = data.getAll('sqft_ordered');

		if (!soNumber || !jobName || !shipDate) return fail(400, { error: 'SO number, job name, and ship date are required.' });

		const [[existing]] = await db.query('SELECT id FROM sales_orders WHERE so_number = ?', [soNumber]);
		if (existing) return fail(400, { error: `SO number '${soNumber}' already exists.` });

		const lines = skuIds
			.map((sid, i) => ({ skuId: sid, sqft: Math.round(Number(sqfts[i])) }))
			.filter(l => l.skuId && l.sqft > 0);

		if (!lines.length) return fail(400, { error: 'Add at least one line item.' });

		const [result] = await db.query(
			'INSERT INTO sales_orders (so_number, job_name, ship_date, created_by) VALUES (?, ?, ?, ?)',
			[soNumber, jobName, shipDate, locals.appUser?.id ?? null]
		);
		const soId = result.insertId;

		for (const l of lines) {
			await db.query(
				'INSERT INTO sales_order_lines (so_id, sku_id, sqft_ordered) VALUES (?, ?, ?)',
				[soId, l.skuId, l.sqft]
			);
		}

		redirect(303, `/so/${soId}`);
	},
};
