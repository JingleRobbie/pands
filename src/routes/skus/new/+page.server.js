import { db } from '$lib/db.js';
import { fail, redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	if (locals.appUser?.role !== 'admin') redirect(302, '/skus');
}

export const actions = {
	default: async ({ request, locals }) => {
		if (locals.appUser?.role !== 'admin') redirect(302, '/skus');
		const data = await request.formData();
		const sku_code = data.get('sku_code')?.trim();
		const display_label = data.get('display_label')?.trim();
		const thickness_in = parseFloat(data.get('thickness_in'));
		const width_in = parseInt(data.get('width_in'));
		const r_value = data.get('r_value')?.trim() || null;
		const sort_order = parseInt(data.get('sort_order')) || 0;
		const is_active = data.has('is_active') ? 1 : 0;
		const pebs = data.has('pebs') ? 1 : 0;

		if (!sku_code) return fail(400, { error: 'SKU code is required.' });
		if (!display_label) return fail(400, { error: 'Display label is required.' });
		if (isNaN(thickness_in) || thickness_in <= 0) return fail(400, { error: 'Valid thickness required.' });
		if (isNaN(width_in) || width_in <= 0) return fail(400, { error: 'Valid width required.' });

		try {
			await db.query(
				'INSERT INTO material_skus (sku_code, display_label, thickness_in, width_in, r_value, sort_order, is_active, pebs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
				[sku_code, display_label, thickness_in, width_in, r_value, sort_order, is_active, pebs]
			);
		} catch (err) {
			if (err.code === 'ER_DUP_ENTRY') return fail(400, { error: `SKU code "${sku_code}" already exists.` });
			return fail(500, { error: err.message });
		}
		redirect(303, `/skus?created=${encodeURIComponent(sku_code)}`);
	},
};
