import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { scheduleGroup } from '$lib/services/production.js';

export async function load({ params }) {
	const [[so]] = await db.query('SELECT * FROM sales_orders WHERE id = ?', [params.id]);
	if (!so) error(404, 'SO not found');
	if (so.status === 'CANCELLED') error(400, 'This SO is cancelled');
	if (so.status === 'COMPLETE') error(400, 'This SO is already complete');

	const [lines] = await db.query(
		`SELECT sol.*, ms.display_label,
		        COALESCE((
		          SELECT SUM(pr.sqft_scheduled)
		          FROM production_runs pr
		          WHERE pr.so_line_id = sol.id AND pr.status != 'COMPLETED'
		        ), 0) AS sqft_in_runs
		 FROM sales_order_lines sol
		 JOIN material_skus ms ON ms.id = sol.sku_id
		 WHERE sol.so_id = ?
		 ORDER BY ms.sort_order`,
		[params.id]
	);

	const enriched = lines.map((l) => ({
		...l,
		sqftUnscheduled: Math.max(
			Number(l.sqft_ordered) - Number(l.sqft_produced) - Number(l.sqft_in_runs),
			0
		),
	}));

	return {
		so,
		schedulableLines: enriched.filter((l) => l.sqftUnscheduled > 0),
		doneLines: enriched.filter((l) => l.sqftUnscheduled === 0),
	};
}

export const actions = {
	default: async ({ request, params, locals }) => {
		const data = await request.formData();

		const lineIds = data.getAll('line_id').map(Number);
		const sqfts = data.getAll('sqft').map((v) => Math.round(Number(v)));
		const runDate = data.get('run_date')?.trim() || null;

		const items = lineIds
			.map((soLineId, i) => ({ soLineId, sqftScheduled: sqfts[i] }))
			.filter((item) => item.sqftScheduled > 0);

		if (items.length === 0)
			return fail(400, { error: 'Enter a sq ft amount for at least one line.' });

		try {
			await scheduleGroup(Number(params.id), items, runDate, locals.appUser?.id);
		} catch (err) {
			return fail(500, { error: err.message });
		}

		redirect(303, `/so/${params.id}`);
	},
};
