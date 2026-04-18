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

	let receivedAt = null;
	if (po.status === 'RECEIVED') {
		const [[row]] = await db.query(
			`SELECT DATE(MIN(it.created_at)) AS received_at
			 FROM inventory_transactions it
			 WHERE it.reference_type = 'PO_LINE'
			   AND it.transaction_type = 'RECEIPT'
			   AND it.reference_id IN (SELECT id FROM purchase_order_lines WHERE po_id = ?)`,
			[params.id]
		);
		receivedAt = row?.received_at ?? null;
	}

	return { po, lines, matrix, receivedAt };
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
