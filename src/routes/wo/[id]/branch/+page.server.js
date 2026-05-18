import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/auth.js';
import { branchLine, getBranchEditBlockers, updateBranchLine } from '$lib/services/cutdown.js';

export async function load({ params, url }) {
	const lineId = parseInt(url.searchParams.get('lineId'));
	if (!lineId) error(400, 'lineId is required');

	const [[wo]] = await db.query('SELECT * FROM work_orders WHERE id = ?', [params.id]);
	if (!wo) error(404, 'Work order not found');

	const [[line]] = await db.query(
		`SELECT wol.*, ms.display_label, ms.pebs
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
	const isEditMode = Number(childCount) > 0;
	const [productionLines] = isEditMode
		? await db.query(
				`SELECT *
				 FROM work_order_lines
				 WHERE parent_line_id = ?
				 ORDER BY id`,
				[lineId]
			)
		: [[]];
	const editBlockers = isEditMode ? await getBranchEditBlockers(lineId) : [];
	const [cutDownBlockers] =
		isEditMode && editBlockers.includes('cut-down')
			? await db.query(
					`SELECT cd.id, cd.cut_down_number, cd.status, cd.run_date, cd.rolls_scheduled,
					        cd.sqft_scheduled, ms.display_label AS sku_label, ms.pebs
					 FROM cut_downs cd
					 JOIN material_skus ms ON ms.id = cd.sku_id
					 WHERE cd.billing_line_id = ? AND cd.wo_id = ?
					 ORDER BY cd.run_date, cd.id`,
					[lineId, params.id]
				)
			: [[]];

	return { wo, line, productionLines, isEditMode, editBlockers, cutDownBlockers };
}

export const actions = {
	branch: async ({ request, params, locals }) => {
		const denied = requireAdmin(locals);
		if (denied) return denied;

		const data = await request.formData();
		const woLineId = parseInt(data.get('woLineId'));
		const woId = parseInt(params.id);
		const mode = data.get('mode') === 'edit' ? 'edit' : 'create';

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
			if (mode === 'edit') {
				await updateBranchLine(woLineId, woId, productionWidths, locals.appUser.id);
			} else {
				await branchLine(woLineId, woId, productionWidths, locals.appUser.id);
			}
		} catch (err) {
			return fail(400, { error: err.message });
		}

		redirect(303, `/wo/${params.id}`);
	},
};
