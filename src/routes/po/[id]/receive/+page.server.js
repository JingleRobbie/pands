import { db } from '$lib/db.js';
import { receivePoLine } from '$lib/services/purchasing.js';
import { redirect, error } from '@sveltejs/kit';

export async function load({ params }) {
	const [[po]] = await db.query('SELECT * FROM purchase_orders WHERE id = ?', [params.id]);
	if (!po) error(404, 'PO not found');
	const [lines] = await db.query(
		`SELECT pol.*, ms.display_label FROM purchase_order_lines pol
		 JOIN material_skus ms ON ms.id = pol.sku_id
		 WHERE pol.po_id = ? AND pol.status = 'OPEN'`,
		[params.id]
	);
	return { po, lines };
}

export const actions = {
	default: async ({ request, params, locals }) => {
		const data = await request.formData();
		const [[po]] = await db.query('SELECT * FROM purchase_orders WHERE id = ?', [params.id]);
		const [lines] = await db.query(
			`SELECT * FROM purchase_order_lines WHERE po_id = ? AND status = 'OPEN'`,
			[params.id]
		);
		for (const line of lines) {
			const val = data.get(`sqft_${line.id}`);
			if (val && Math.round(Number(val)) > 0) {
				await receivePoLine(line.id, Math.round(Number(val)), locals.appUser?.id);
			}
		}
		redirect(303, `/po/${params.id}`);
	},
};
