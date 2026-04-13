import { db } from '$lib/db.js';
import { error, redirect } from '@sveltejs/kit';
import { getMatrixDataForSkus } from '$lib/services/inventory.js';

export async function load({ params }) {
	const [[po]] = await db.query('SELECT * FROM purchase_orders WHERE id = ?', [params.id]);
	if (!po) error(404, 'PO not found');
	const [lines] = await db.query(
		'SELECT pol.*, ms.display_label FROM purchase_order_lines pol JOIN material_skus ms ON ms.id = pol.sku_id WHERE pol.po_id = ?',
		[params.id]
	);
	const skuIds = [...new Set(lines.map((l) => l.sku_id))];
	const matrix = await getMatrixDataForSkus(skuIds);
	return { po, lines, matrix };
}

export const actions = {
	cancel: async ({ params }) => {
		await db.query('UPDATE purchase_orders SET status = "CANCELLED" WHERE id = ?', [params.id]);
		await db.query(
			'UPDATE purchase_order_lines SET status = "CANCELLED" WHERE po_id = ? AND status = "OPEN"',
			[params.id]
		);
		redirect(303, '/po');
	},
};
