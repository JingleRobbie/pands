import { db } from '$lib/db.js';
import { safeReturnTo, withReturnTo } from '$lib/navigation.js';
import { error, fail, redirect } from '@sveltejs/kit';

export async function load({ params, locals }) {
	const [[po]] = await db.query('SELECT * FROM purchase_orders WHERE id = ?', [params.id]);
	if (!po) error(404, 'PO not found');
	if (po.status !== 'OPEN') error(400, 'Only open POs can be edited');

	const [lines] = await db.query(
		`SELECT pol.*, ms.display_label, ms.pebs
		 FROM purchase_order_lines pol
		 JOIN material_skus ms ON ms.id = pol.sku_id
		 WHERE pol.po_id = ?
		 ORDER BY pol.id`,
		[params.id]
	);
	return { po, lines, user: locals.appUser };
}

export const actions = {
	default: async ({ request, params }) => {
		const data = await request.formData();
		const returnTo = safeReturnTo(data.get('return_to'), '/po');

		const [[po]] = await db.query('SELECT * FROM purchase_orders WHERE id = ?', [params.id]);
		if (!po) return fail(404, { error: 'PO not found.' });
		if (po.status !== 'OPEN') return fail(400, { error: 'Only open POs can be edited.' });

		const expectedDate = data.get('expected_date')?.trim();
		if (!expectedDate) return fail(400, { error: 'Expected date is required.' });

		await db.query('UPDATE purchase_orders SET expected_date = ? WHERE id = ?', [
			expectedDate,
			params.id,
		]);

		redirect(303, withReturnTo(`/po/${params.id}`, returnTo));
	},
};
