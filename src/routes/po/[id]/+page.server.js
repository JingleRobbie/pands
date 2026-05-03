import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { getMatrixDataForSkus } from '$lib/services/inventory.js';
import { requireAdmin } from '$lib/auth.js';
import { unreceivePoLines } from '$lib/services/purchasing.js';

export async function load({ params, locals }) {
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

	return { po, lines, matrix, receivedAt, user: locals.appUser };
}

export const actions = {
	cancel: async ({ params, locals }) => {
		const denied = requireAdmin(locals);
		if (denied) return denied;
		await db.query('UPDATE purchase_orders SET status = "CANCELLED" WHERE id = ?', [params.id]);
		await db.query(
			'UPDATE purchase_order_lines SET status = "CANCELLED" WHERE po_id = ? AND status = "OPEN"',
			[params.id]
		);
		redirect(303, '/po');
	},
	unreceive: async ({ request, params, locals }) => {
		const denied = requireAdmin(locals);
		if (denied) return denied;

		const data = await request.formData();
		const requestedLineIds = data.getAll('line_id').map(Number).filter(Boolean);

		let lineIds = requestedLineIds;
		if (lineIds.length === 0) {
			const [rows] = await db.query(
				`SELECT id
				 FROM purchase_order_lines
				 WHERE po_id = ? AND status = 'RECEIVED'
				 ORDER BY id`,
				[params.id]
			);
			lineIds = rows.map((row) => row.id);
		}

		try {
			await unreceivePoLines(Number(params.id), lineIds, locals.appUser.id);
		} catch (err) {
			return fail(500, { error: err.message });
		}

		redirect(303, `/po/${params.id}`);
	},
};
