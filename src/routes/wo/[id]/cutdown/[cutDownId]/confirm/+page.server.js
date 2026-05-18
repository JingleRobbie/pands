import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/auth.js';
import { confirmCutDown, unconfirmCutDown } from '$lib/services/cutdown.js';

export async function load({ params }) {
	const [[wo]] = await db.query('SELECT * FROM work_orders WHERE id = ?', [params.id]);
	if (!wo) error(404, 'Work order not found');

	const [[cutDown]] = await db.query(
		`SELECT cd.*, ms.display_label AS sku_label, ms.pebs
		 FROM cut_downs cd
		 JOIN material_skus ms ON ms.id = cd.sku_id
		 WHERE cd.id = ? AND cd.wo_id = ?`,
		[params.cutDownId, params.id]
	);
	if (!cutDown) error(404, 'Cut-down not found');

	const [[billingLine]] = await db.query('SELECT * FROM work_order_lines WHERE id = ?', [
		cutDown.billing_line_id,
	]);

	const [productionLines] = await db.query(
		'SELECT * FROM work_order_lines WHERE parent_line_id = ? ORDER BY id',
		[cutDown.billing_line_id]
	);

	// Preview of WIP CUT_IN entries — prorates billing line sqft (usable output), not raw source
	const usableOutputSqft = Number(billingLine.sqft);
	const totalChildWidth = productionLines.reduce((s, l) => s + Number(l.width_in), 0);
	let allocatedSqft = 0;
	const wipPreview = productionLines.map((l, i) => {
		const isLast = i === productionLines.length - 1;
		const estimatedSqft = isLast
			? usableOutputSqft - allocatedSqft
			: Math.round(
					totalChildWidth > 0
						? (Number(l.width_in) / totalChildWidth) * usableOutputSqft
						: usableOutputSqft / productionLines.length
				);
		allocatedSqft += estimatedSqft;
		return { ...l, estimatedSqft };
	});

	return { wo, cutDown, billingLine, productionLines, wipPreview };
}

export const actions = {
	confirmCutDown: async ({ request, params, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const cutDownId = parseInt(params.cutDownId);
		const rollsActual = parseInt(data.get('rollsActual'));
		const sqftActual = data.get('sqftActual') ? parseInt(data.get('sqftActual')) : null;
		const wasteActual = data.get('wasteActual') ? parseInt(data.get('wasteActual')) : null;
		const scrapDisposition = data.get('scrapDisposition') || null;
		const operatorNotes = data.get('operatorNotes') || null;

		if (!rollsActual || rollsActual < 1)
			return fail(400, { error: 'Rolls actual is required.' });
		if (!scrapDisposition) return fail(400, { error: 'Scrap disposition is required.' });

		try {
			await confirmCutDown(
				cutDownId,
				rollsActual,
				sqftActual,
				wasteActual,
				scrapDisposition,
				operatorNotes,
				locals.appUser.id
			);
		} catch (err) {
			return fail(400, { error: err.message });
		}

		redirect(303, `/wo/${params.id}/cutdown`);
	},

	unconfirmCutDown: async ({ params, locals }) => {
		requireAdmin(locals);
		const cutDownId = parseInt(params.cutDownId);
		let result;
		try {
			result = await unconfirmCutDown(cutDownId, locals.appUser.id);
		} catch (err) {
			return fail(400, { error: err.message });
		}

		const { warnings } = result;
		const hasWarnings = warnings.runNumbers.length > 0 || warnings.shipmentNumbers.length > 0;

		if (hasWarnings) {
			return { warnings };
		}

		redirect(303, `/wo/${params.id}/cutdown`);
	},
};
