import { db } from '$lib/db.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	const [[po]] = await db.query('SELECT * FROM purchase_orders WHERE id = ?', [params.id]);
	if (!po) error(404, 'PO not found');
	const [lines] = await db.query(
		'SELECT pol.*, ms.display_label FROM purchase_order_lines pol JOIN material_skus ms ON ms.id = pol.sku_id WHERE pol.po_id = ?',
		[params.id]
	);
	return { po, lines };
}
