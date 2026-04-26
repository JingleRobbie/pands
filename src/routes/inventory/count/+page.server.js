import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { getCountBalancesAsOf, createCountBatch } from '$lib/services/inventory.js';
import { localDate } from '$lib/utils.js';

export async function load({ locals }) {
	if (locals.appUser?.role !== 'admin') error(403, 'Admin only');
	const [skus] = await db.query(
		'SELECT id, display_label FROM material_skus WHERE is_active = TRUE ORDER BY sort_order, thickness_in, width_in'
	);
	const today = localDate();
	const balances = await getCountBalancesAsOf(today);
	return { skus, balances };
}

export const actions = {
	preview: async ({ request, locals }) => {
		if (locals.appUser?.role !== 'admin') error(403, 'Admin only');
		const data = await request.formData();
		const memo = data.get('memo')?.trim() || '';
		const countDate = data.get('count_date')?.trim() || localDate();

		const [skus] = await db.query(
			'SELECT id, display_label FROM material_skus WHERE is_active = TRUE ORDER BY sort_order, thickness_in, width_in'
		);
		const balances = await getCountBalancesAsOf(countDate);

		const preview = [];
		for (const sku of skus) {
			const raw = data.get(`count_${sku.id}`);
			if (raw === null || String(raw).trim() === '') continue;
			const newCount = parseInt(raw);
			if (isNaN(newCount) || newCount < 0) continue;
			const currentBalance = balances[sku.id] ?? 0;
			const delta = newCount - currentBalance;
			if (delta === 0) continue;
			preview.push({
				skuId: sku.id,
				label: sku.display_label,
				currentBalance,
				newCount,
				delta,
			});
		}

		if (preview.length === 0)
			return fail(400, {
				error: 'No changes detected — all entered counts match current balances or were left blank.',
			});

		return { preview, memo, countDate };
	},

	back: async ({ request, locals }) => {
		if (locals.appUser?.role !== 'admin') error(403, 'Admin only');
		const data = await request.formData();
		const memo = data.get('memo')?.trim() || '';
		const countDate = data.get('count_date')?.trim() || localDate();
		const skuIds = data.getAll('sku_id').map(Number);
		const newCounts = data.getAll('new_count').map(Number);
		const counts = Object.fromEntries(skuIds.map((id, i) => [id, newCounts[i]]));
		return { back: true, counts, memo, countDate };
	},

	commit: async ({ request, locals }) => {
		if (locals.appUser?.role !== 'admin') error(403, 'Admin only');
		const data = await request.formData();
		const memo = data.get('memo')?.trim() || '';
		const countDate = data.get('count_date')?.trim() || localDate();
		const skuIds = data.getAll('sku_id').map(Number);
		const deltas = data.getAll('delta').map(Number);
		const newCounts = data.getAll('new_count').map(Number);

		if (skuIds.length === 0) return fail(400, { error: 'No adjustments to commit.' });

		const items = skuIds.map((skuId, i) => ({
			skuId,
			delta: deltas[i],
			newCount: newCounts[i],
		}));

		try {
			await createCountBatch(items, memo, countDate, locals.appUser.id);
		} catch (err) {
			return fail(500, { error: err.message });
		}

		redirect(303, '/inventory/counts');
	},
};
