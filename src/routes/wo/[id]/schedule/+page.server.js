import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { scheduleGroup } from '$lib/services/production.js';

export async function load({ params }) {
	const [[wo]] = await db.query('SELECT * FROM work_orders WHERE id = ?', [params.id]);
	if (!wo) error(404, 'Work order not found');
	if (wo.status === 'CANCELLED') error(400, 'This work order is cancelled');
	if (wo.status === 'COMPLETE') error(400, 'This work order is already complete');

	const [lines] = await db.query(
		`SELECT wol.*, ms.display_label,
		        COALESCE((
		          SELECT SUM(pr.rolls_scheduled)
		          FROM production_runs pr
		          WHERE pr.wo_line_id = wol.id AND pr.status != 'COMPLETED'
		        ), 0) AS rolls_in_runs
		 FROM work_order_lines wol
		 JOIN material_skus ms ON ms.id = wol.sku_id
		 WHERE wol.wo_id = ?
		 ORDER BY ms.sort_order`,
		[params.id]
	);

	const enriched = lines.map((l) => ({
		...l,
		rollsUnscheduled: Math.max(
			Number(l.qty) - Number(l.rolls_produced) - Number(l.rolls_in_runs),
			0
		),
		sqftPerRoll: Math.round((Number(l.width_in) / 12) * Number(l.length_ft)),
	}));

	return {
		wo,
		schedulableLines: enriched.filter((l) => l.rollsUnscheduled > 0),
		doneLines: enriched.filter((l) => l.rollsUnscheduled === 0),
	};
}

export const actions = {
	default: async ({ request, params, locals }) => {
		const data = await request.formData();

		const lineIds = data.getAll('line_id').map(Number);
		const rolls = data.getAll('rolls').map((v) => parseInt(v) || 0);
		const runDate = data.get('run_date')?.trim() || null;

		const items = lineIds
			.map((woLineId, i) => ({ woLineId, rollsScheduled: rolls[i] }))
			.filter((item) => item.rollsScheduled > 0);

		if (!runDate) return fail(400, { error: 'Production date is required.' });
		if (items.length === 0)
			return fail(400, { error: 'Enter a roll count for at least one line.' });

		try {
			await scheduleGroup(Number(params.id), items, runDate, locals.appUser?.id);
		} catch (err) {
			return fail(500, { error: err.message });
		}

		redirect(303, `/wo/${params.id}`);
	},
};
