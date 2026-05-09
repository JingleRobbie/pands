import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/auth.js';
import { reconcileBillingLine, splitBillingLine } from '$lib/services/cutdown.js';

export async function load({ params }) {
	const [[wo]] = await db.query(
		`SELECT wo.*, c.name AS customer_display_name
		 FROM work_orders wo
		 LEFT JOIN customers c ON c.id = wo.customer_id
		 WHERE wo.id = ?`,
		[params.id]
	);
	if (!wo) error(404, 'Work order not found');

	const [lines] = await db.query(
		`SELECT wol.*, ms.display_label,
		        (SELECT COUNT(*) FROM work_order_lines c WHERE c.parent_line_id = wol.id) AS child_count
		 FROM work_order_lines wol
		 JOIN material_skus ms ON ms.id = wol.sku_id
		 WHERE wol.wo_id = ?
		 ORDER BY wol.id`,
		[params.id]
	);

	// Build diffRows: one per billing/unbranched line with its production children
	const billingAndUnbranched = lines.filter((l) => l.parent_line_id === null);
	const productionLines = lines.filter((l) => l.parent_line_id !== null);

	const [cutDowns] = await db.query(
		`SELECT cd.id, cd.billing_line_id, cd.status, cd.sku_id, cd.confirmed_at,
		        ms.display_label AS sku_label
		 FROM cut_downs cd
		 JOIN material_skus ms ON ms.id = cd.sku_id
		 WHERE cd.wo_id = ?
		 ORDER BY cd.confirmed_at DESC`,
		[params.id]
	);

	const cutDownByLine = {};
	for (const cd of cutDowns) {
		if (!cutDownByLine[cd.billing_line_id]) cutDownByLine[cd.billing_line_id] = cd;
	}

	const diffRows = billingAndUnbranched.map((bl) => {
		const isUnbranched = Number(bl.child_count) === 0;
		const children = isUnbranched
			? []
			: productionLines.filter((p) => p.parent_line_id === bl.id);
		return {
			billingLine: bl,
			productionLines: children,
			cutDown: cutDownByLine[bl.id] ?? null,
			isUnbranched,
			needsReconciliation: bl.reconciliation_status === 'STALE',
		};
	});

	const [skus] = await db.query(
		'SELECT id, display_label FROM material_skus WHERE active = 1 ORDER BY sort_order'
	);

	return { wo, diffRows, skus };
}

export const actions = {
	reconcileLine: async ({ request, params, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const billingLineId = parseInt(data.get('billingLineId'));
		if (!billingLineId) return fail(400, { error: 'Billing line ID required.' });

		const updates = {};
		const skuId = data.get('newSkuId');
		const widthIn = data.get('newWidthIn');
		const qty = data.get('newQty');
		const lengthFt = data.get('newLengthFt');
		if (skuId) updates.newSkuId = parseInt(skuId);
		if (widthIn) updates.newWidthIn = parseFloat(widthIn);
		if (qty) updates.newQty = parseInt(qty);
		if (lengthFt) updates.newLengthFt = parseFloat(lengthFt);

		try {
			await reconcileBillingLine(billingLineId, updates, locals.appUser.id);
		} catch (err) {
			return fail(400, { error: err.message });
		}
		redirect(303, `/wo/${params.id}/diff`);
	},

	splitLine: async ({ request, params, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const billingLineId = parseInt(data.get('billingLineId'));
		const rawNewLines = data.get('newLines');
		if (!billingLineId) return fail(400, { error: 'Billing line ID required.' });

		let newLines;
		try {
			newLines = JSON.parse(rawNewLines);
		} catch {
			return fail(400, { error: 'Invalid newLines payload.' });
		}

		try {
			await splitBillingLine(billingLineId, newLines, locals.appUser.id);
		} catch (err) {
			return fail(400, { error: err.message });
		}
		redirect(303, `/wo/${params.id}/diff`);
	},
};
