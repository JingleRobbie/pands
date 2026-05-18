import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';

export async function load({ params, locals }) {
	if (locals.appUser?.role !== 'admin') redirect(302, '/skus');
	const id = parseInt(params.id);
	if (!id) error(404, 'SKU not found');
	const [[sku]] = await db.query(
		'SELECT id, sku_code, thickness_in, width_in, r_value, display_label, sort_order, is_active, pebs FROM material_skus WHERE id = ?',
		[id]
	);
	if (!sku) error(404, 'SKU not found');
	return { sku };
}

export const actions = {
	default: async ({ request, params, locals }) => {
		if (locals.appUser?.role !== 'admin') redirect(302, '/skus');
		const id = parseInt(params.id);
		const data = await request.formData();
		const display_label = data.get('display_label')?.trim();
		const r_value = data.get('r_value')?.trim() || null;
		const sort_order = parseInt(data.get('sort_order'));
		const is_active = data.has('is_active') ? 1 : 0;
		const pebs = data.has('pebs') ? 1 : 0;

		if (!display_label) return fail(400, { error: 'Display label is required.' });
		if (isNaN(sort_order)) return fail(400, { error: 'Sort order must be a number.' });

		try {
			await db.query(
				'UPDATE material_skus SET display_label=?, r_value=?, sort_order=?, is_active=?, pebs=? WHERE id=?',
				[display_label, r_value, sort_order, is_active, pebs, id]
			);
		} catch (err) {
			return fail(500, { error: err.message });
		}
		return { success: true };
	},
};
