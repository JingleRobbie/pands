import { db } from '$lib/db.js';
import { safeReturnTo, withReturnTo } from '$lib/navigation.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { scheduleGroup } from '$lib/services/runs.js';
import { inferPathType } from '$lib/services/line-paths.js';

export async function load({ params }) {
	const [[wo]] = await db.query('SELECT * FROM work_orders WHERE id = ?', [params.id]);
	if (!wo) error(404, 'Work order not found');
	if (wo.status === 'CANCELLED') error(400, 'This work order is cancelled');
	if (wo.status === 'COMPLETE') error(400, 'This work order is already complete');

	const [lines] = await db.query(
		`SELECT wol.*, ms.display_label, ms.pebs,
		        COALESCE((
		          SELECT SUM(pr.rolls_scheduled)
		          FROM production_runs pr
		          WHERE pr.wo_line_id = wol.id AND pr.status != 'COMPLETED'
		        ), 0) AS rolls_in_runs,
		        (SELECT COUNT(*) FROM work_order_lines c WHERE c.parent_line_id = wol.id) AS child_count,
		        (SELECT COUNT(*) FROM cut_downs cd WHERE cd.billing_line_id = wol.id AND cd.status = 'COMPLETED') AS confirmed_cut_down_count
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

	const standardLines = enriched.filter((l) => inferPathType(l) === 'STANDARD');
	const cutLaminateLines = enriched.filter((l) => inferPathType(l) === 'CUT_LAMINATE');

	const parentIds = new Set(cutLaminateLines.map((l) => l.parent_line_id).filter(Boolean));
	const billingGroups = [...parentIds].map((parentId) => {
		const parent = enriched.find((l) => l.id === parentId);
		const children = cutLaminateLines.filter((l) => l.parent_line_id === parentId);
		const schedulableChildren = children.filter((l) => l.rollsUnscheduled > 0);

		const childGroupMap = new Map();
		for (const child of schedulableChildren) {
			const key = [
				child.rollfor ?? '',
				child.facing ?? '',
				child.thickness_in ?? '',
				child.width_in ?? '',
				child.length_ft ?? '',
			].join('|');
			if (!childGroupMap.has(key)) {
				childGroupMap.set(key, {
					groupKey: key,
					children: [],
					rollsUnscheduled: 0,
					sqftPerRoll: child.sqftPerRoll,
					rollfor: child.rollfor,
					facing: child.facing,
					thickness_in: child.thickness_in,
					width_in: child.width_in,
					length_ft: child.length_ft,
				});
			}
			const g = childGroupMap.get(key);
			g.children.push(child);
			g.rollsUnscheduled += child.rollsUnscheduled;
		}

		return {
			parent,
			schedulableChildGroups: [...childGroupMap.values()],
			doneChildCount: children.filter((l) => l.rollsUnscheduled === 0).length,
		};
	});

	return {
		wo,
		schedulableLines: standardLines.filter((l) => l.rollsUnscheduled > 0),
		doneLines: standardLines.filter((l) => l.rollsUnscheduled === 0),
		billingGroups,
	};
}

export const actions = {
	default: async ({ request, params, locals }) => {
		const data = await request.formData();
		const returnTo = safeReturnTo(data.get('return_to'), `/wo/${params.id}`);

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

		redirect(303, withReturnTo(`/wo/${params.id}`, returnTo));
	},
};
