import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';

export async function load({ params }) {
	const [[po]] = await db.query('SELECT * FROM purchase_orders WHERE id = ?', [params.id]);
	if (!po) error(404, 'PO not found');
	if (po.status !== 'OPEN') error(400, 'Only open POs can be edited');

	const [lines] = await db.query(
		`SELECT pol.*, ms.display_label
		 FROM purchase_order_lines pol
		 JOIN material_skus ms ON ms.id = pol.sku_id
		 WHERE pol.po_id = ?
		 ORDER BY pol.id`,
		[params.id]
	);
	const [skus] = await db.query(
		'SELECT * FROM material_skus WHERE is_active = TRUE ORDER BY sort_order'
	);
	return { po, lines, skus };
}

export const actions = {
	default: async ({ request, params }) => {
		const data = await request.formData();

		const [[po]] = await db.query('SELECT * FROM purchase_orders WHERE id = ?', [params.id]);
		if (!po) return fail(404, { error: 'PO not found.' });
		if (po.status !== 'OPEN') return fail(400, { error: 'Only open POs can be edited.' });

		const poNumber = data.get('po_number')?.trim();
		const vendorName = data.get('vendor_name')?.trim();
		const expectedDate = data.get('expected_date')?.trim();
		if (!poNumber || !expectedDate)
			return fail(400, { error: 'PO number and expected date are required.' });
		if (!['Johns Manville', 'Certainteed'].includes(vendorName))
			return fail(400, { error: 'Invalid vendor.' });

		// Check duplicate po_number (excluding current PO)
		const [[existing]] = await db.query(
			'SELECT id FROM purchase_orders WHERE po_number = ? AND id != ?',
			[poNumber, params.id]
		);
		if (existing) return fail(400, { error: `PO number '${poNumber}' already exists.` });

		// Existing open lines submitted (kept lines — removed ones are absent)
		const keptIds = data.getAll('line_id').map(Number);
		const keptSqfts = data.getAll('line_sqft').map((v) => Math.round(Number(v)));

		// New lines
		const newSkuIds = data.getAll('sku_id');
		const newSqfts = data.getAll('sqft_ordered');
		const newLines = newSkuIds
			.map((sid, i) => ({ skuId: sid, sqft: Math.round(Number(newSqfts[i])) }))
			.filter((l) => l.skuId && l.sqft > 0);

		// Load current open lines to validate
		const [openLines] = await db.query(
			"SELECT id FROM purchase_order_lines WHERE po_id = ? AND status = 'OPEN'",
			[params.id]
		);
		const openLineIds = openLines.map((l) => l.id);

		// Validate kept sqfts
		for (let i = 0; i < keptIds.length; i++) {
			if (!keptSqfts[i] || keptSqfts[i] < 1)
				return fail(400, { error: 'All kept line quantities must be at least 1.' });
		}

		const conn = await db.getConnection();
		try {
			await conn.beginTransaction();

			await conn.query(
				'UPDATE purchase_orders SET po_number = ?, vendor_name = ?, expected_date = ? WHERE id = ?',
				[poNumber, vendorName, expectedDate, params.id]
			);

			// Delete open lines not in keptIds
			for (const lineId of openLineIds) {
				if (!keptIds.includes(lineId)) {
					await conn.query('DELETE FROM purchase_order_lines WHERE id = ?', [lineId]);
				}
			}

			// Update sqft on kept open lines
			for (let i = 0; i < keptIds.length; i++) {
				if (openLineIds.includes(keptIds[i])) {
					await conn.query(
						'UPDATE purchase_order_lines SET sqft_ordered = ? WHERE id = ?',
						[keptSqfts[i], keptIds[i]]
					);
				}
			}

			// Insert new lines
			for (const l of newLines) {
				await conn.query(
					'INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered) VALUES (?, ?, ?)',
					[params.id, l.skuId, l.sqft]
				);
			}

			await conn.commit();
		} catch (err) {
			await conn.rollback();
			return fail(500, { error: err.message });
		} finally {
			conn.release();
		}

		redirect(303, `/po/${params.id}`);
	},
};
