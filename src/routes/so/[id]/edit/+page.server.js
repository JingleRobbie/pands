import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';

export async function load({ params }) {
	const [[so]] = await db.query('SELECT * FROM sales_orders WHERE id = ?', [params.id]);
	if (!so) error(404, 'SO not found');
	if (!['OPEN', 'IN_PROGRESS'].includes(so.status))
		error(400, 'Only open or in-progress SOs can be edited');

	const [lines] = await db.query(
		`SELECT sol.*,
		        ms.display_label,
		        COALESCE((SELECT COUNT(*) FROM production_runs pr WHERE pr.so_line_id = sol.id), 0) AS run_count
		 FROM sales_order_lines sol
		 JOIN material_skus ms ON ms.id = sol.sku_id
		 WHERE sol.so_id = ?
		 ORDER BY sol.id`,
		[params.id]
	);
	const [skus] = await db.query(
		'SELECT * FROM material_skus WHERE is_active = TRUE ORDER BY sort_order'
	);
	return { so, lines, skus };
}

export const actions = {
	default: async ({ request, params }) => {
		const data = await request.formData();

		const [[so]] = await db.query('SELECT * FROM sales_orders WHERE id = ?', [params.id]);
		if (!so) return fail(404, { error: 'SO not found.' });
		if (!['OPEN', 'IN_PROGRESS'].includes(so.status))
			return fail(400, { error: 'Only open or in-progress SOs can be edited.' });

		const soNumber = data.get('so_number')?.trim();
		const customerName = data.get('customer_name')?.trim();
		const jobName = data.get('job_name')?.trim();
		const shipDate = data.get('ship_date')?.trim();
		if (!soNumber || !customerName || !jobName || !shipDate)
			return fail(400, {
				error: 'SO number, customer, job name, and ship date are required.',
			});

		const [[existing]] = await db.query(
			'SELECT id FROM sales_orders WHERE so_number = ? AND id != ?',
			[soNumber, params.id]
		);
		if (existing) return fail(400, { error: `SO number '${soNumber}' already exists.` });

		// Editable kept lines (no runs)
		const keptIds = data.getAll('line_id').map(Number);
		const keptSqfts = data.getAll('line_sqft').map((v) => Math.round(Number(v)));
		const keptFacings = data.getAll('line_facing');

		// New lines
		const newSkuIds = data.getAll('sku_id');
		const newSqfts = data.getAll('sqft_ordered');
		const newFacings = data.getAll('new_facing');
		const newLines = newSkuIds
			.map((sid, i) => ({
				skuId: sid,
				sqft: Math.round(Number(newSqfts[i])),
				facing: newFacings[i] || 'Faced',
			}))
			.filter((l) => l.skuId && l.sqft > 0);

		// Load editable lines (no runs) to validate
		const [editableLines] = await db.query(
			`SELECT sol.id, sol.sqft_produced
			 FROM sales_order_lines sol
			 WHERE sol.so_id = ?
			   AND (SELECT COUNT(*) FROM production_runs pr WHERE pr.so_line_id = sol.id) = 0`,
			[params.id]
		);
		const editableIds = editableLines.map((l) => l.id);
		const editableMap = Object.fromEntries(editableLines.map((l) => [l.id, l]));

		for (let i = 0; i < keptIds.length; i++) {
			const sqft = keptSqfts[i];
			if (!sqft || sqft < 1)
				return fail(400, { error: 'All line quantities must be at least 1.' });
			const line = editableMap[keptIds[i]];
			if (line && sqft < Number(line.sqft_produced))
				return fail(400, {
					error: 'Sq ft cannot be less than what has already been produced.',
				});
		}

		const conn = await db.getConnection();
		try {
			await conn.beginTransaction();

			await conn.query(
				'UPDATE sales_orders SET so_number = ?, customer_name = ?, job_name = ?, ship_date = ? WHERE id = ?',
				[soNumber, customerName, jobName, shipDate, params.id]
			);

			// Delete editable lines not in keptIds
			for (const lineId of editableIds) {
				if (!keptIds.includes(lineId)) {
					await conn.query('DELETE FROM sales_order_lines WHERE id = ?', [lineId]);
				}
			}

			// Update sqft on kept editable lines
			for (let i = 0; i < keptIds.length; i++) {
				if (editableIds.includes(keptIds[i])) {
					await conn.query(
						'UPDATE sales_order_lines SET sqft_ordered = ?, facing = ? WHERE id = ?',
						[keptSqfts[i], keptFacings[i] || 'Faced', keptIds[i]]
					);
				}
			}

			// Insert new lines
			for (const l of newLines) {
				await conn.query(
					'INSERT INTO sales_order_lines (so_id, sku_id, sqft_ordered, facing) VALUES (?, ?, ?, ?)',
					[params.id, l.skuId, l.sqft, l.facing]
				);
			}

			await conn.commit();
		} catch (err) {
			await conn.rollback();
			return fail(500, { error: err.message });
		} finally {
			conn.release();
		}

		redirect(303, `/so/${params.id}`);
	},
};
