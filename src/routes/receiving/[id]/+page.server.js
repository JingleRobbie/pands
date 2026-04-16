import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { receivePoLines } from '$lib/services/purchasing.js';

export async function load({ params }) {
	const [[po]] = await db.query('SELECT * FROM purchase_orders WHERE id = ?', [params.id]);
	if (!po) error(404, 'PO not found');
	if (po.status !== 'OPEN') error(400, 'This PO is not open for receiving');

	const [lines] = await db.query(
		`SELECT pol.*, ms.display_label
		 FROM purchase_order_lines pol
		 JOIN material_skus ms ON ms.id = pol.sku_id
		 WHERE pol.po_id = ?
		 ORDER BY pol.id`,
		[params.id]
	);

	const openLines = lines.filter((l) => l.status === 'OPEN');
	const doneLines = lines.filter((l) => l.status !== 'OPEN');

	return { po, openLines, doneLines };
}

export const actions = {
	default: async ({ request, params, locals }) => {
		const data = await request.formData();

		const [[po]] = await db.query('SELECT status FROM purchase_orders WHERE id = ?', [
			params.id,
		]);
		if (!po) return fail(404, { error: 'PO not found.' });
		if (po.status !== 'OPEN') return fail(400, { error: 'This PO is not open for receiving.' });

		const lineIds = data.getAll('line_id').map(Number);
		const sqftsReceived = data.getAll('sqft_received').map((v) => Math.round(Number(v)));

		for (let i = 0; i < lineIds.length; i++) {
			if (!sqftsReceived[i] || sqftsReceived[i] < 1)
				return fail(400, { error: 'All received quantities must be at least 1.' });
		}

		const receipts = lineIds.map((lineId, i) => ({ lineId, sqftReceived: sqftsReceived[i] }));

		try {
			await receivePoLines(Number(params.id), receipts, locals.appUser.id);
		} catch (err) {
			return fail(500, { error: err.message });
		}

		redirect(303, '/receiving');
	},
};
