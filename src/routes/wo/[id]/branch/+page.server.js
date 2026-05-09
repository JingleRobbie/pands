import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/auth.js';
import { branchLine } from '$lib/services/cutdown.js';

export async function load({ params, url }) {
	const lineId = parseInt(url.searchParams.get('lineId'));
	if (!lineId) error(400, 'lineId is required');

	const [[wo]] = await db.query('SELECT * FROM work_orders WHERE id = ?', [params.id]);
	if (!wo) error(404, 'Work order not found');

	const [[line]] = await db.query(
		`SELECT wol.*, ms.display_label
		 FROM work_order_lines wol
		 JOIN material_skus ms ON ms.id = wol.sku_id
		 WHERE wol.id = ? AND wol.wo_id = ?`,
		[lineId, params.id]
	);
	if (!line) error(404, 'Line not found');
	if (line.parent_line_id !== null) error(400, 'Cannot branch a production line');

	const [[{ childCount }]] = await db.query(
		'SELECT COUNT(*) AS childCount FROM work_order_lines WHERE parent_line_id = ?',
		[lineId]
	);
	if (Number(childCount) > 0) error(400, 'Line has already been branched');

	return { wo, line };
}

export const actions = {
	branch: async ({ request, params, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const woLineId = parseInt(data.get('woLineId'));

		// Parse repeating width/qty/length_ft fields: width_0, qty_0, length_ft_0, ...
		const productionWidths = [];
		let i = 0;
		while (data.has(`width_${i}`)) {
			const width_in = parseFloat(data.get(`width_${i}`));
			const qty = parseInt(data.get(`qty_${i}`));
			const length_ft = parseFloat(data.get(`length_ft_${i}`));
			if (!width_in || width_in <= 0)
				return fail(400, { error: `Row ${i + 1}: width is required.` });
			productionWidths.push({
				width_in,
				qty: qty || undefined,
				length_ft: length_ft || undefined,
			});
			i++;
		}

		if (productionWidths.length === 0)
			return fail(400, { error: 'At least one production width is required.' });

		try {
			await branchLine(woLineId, productionWidths, locals.appUser.id);
		} catch (err) {
			return fail(400, { error: err.message });
		}

		redirect(303, `/wo/${params.id}?tab=production`);
	},
};
