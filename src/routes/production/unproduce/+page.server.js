import { db } from '$lib/db.js';
import { unproduceRun } from '$lib/services/production.js';
import { error, fail, redirect } from '@sveltejs/kit';

function dateOnly(value) {
	if (!value) return null;
	return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

async function getDefaultDates() {
	const [rows] = await db.query(
		`SELECT DISTINCT eligible.production_date
		 FROM (
		   SELECT DATE(pr.run_date) AS production_date,
		          pr.rolls_actual - COALESCE(SUM(sl.rolls), 0) AS unshipped_rolls
		   FROM production_runs pr
		   LEFT JOIN shipment_lines sl ON sl.production_run_id = pr.id
		   WHERE pr.status = 'COMPLETED' AND pr.run_date IS NOT NULL
		   GROUP BY pr.id
		   HAVING unshipped_rolls > 0
		 ) eligible
		 ORDER BY production_date DESC
		 LIMIT 3`
	);
	return [...new Set(rows.map((row) => dateOnly(row.production_date)).filter(Boolean))];
}

async function getEligibleRuns({ selectedDate = null } = {}) {
	const params = [];
	let dateWhere;
	if (selectedDate) {
		dateWhere = 'AND pr.run_date = ?';
		params.push(selectedDate);
	} else {
		const dates = await getDefaultDates();
		if (dates.length === 0) return [];
		dateWhere = 'AND pr.run_date IN (?)';
		params.push(dates);
	}

	const [runs] = await db.query(
		`SELECT pr.id, pr.run_date, pr.rolls_actual, pr.sqft_actual,
		        ms.display_label, wol.facing, wol.rollfor,
		        wo.id AS wo_id, wo.so_number, wo.job_name, wo.customer_name,
		        COALESCE(SUM(sl.rolls), 0) AS allocated_rolls,
		        COALESCE(SUM(sl.sqft), 0) AS allocated_sqft,
		        pr.rolls_actual - COALESCE(SUM(sl.rolls), 0) AS unshipped_rolls,
		        pr.sqft_actual - COALESCE(SUM(sl.sqft), 0) AS unshipped_sqft
		 FROM production_runs pr
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		 JOIN work_orders wo ON wo.id = wol.wo_id
		 LEFT JOIN shipment_lines sl ON sl.production_run_id = pr.id
		 WHERE pr.status = 'COMPLETED'
		   ${dateWhere}
		 GROUP BY pr.id
		 HAVING unshipped_rolls > 0
		 ORDER BY pr.run_date DESC, wo.customer_name, wo.so_number, ms.sort_order`,
		params
	);

	return runs;
}

export async function load({ url, locals }) {
	if (locals.appUser?.role !== 'admin') error(403, 'Admin only');

	const selectedDate = url.searchParams.get('date') || null;
	const eligibleRuns = await getEligibleRuns({ selectedDate });
	return { eligibleRuns, selectedDate };
}

export const actions = {
	default: async ({ request, locals }) => {
		if (locals.appUser?.role !== 'admin') error(403, 'Admin only');

		const data = await request.formData();
		const runId = Number(data.get('run_id'));
		const rollsToUnproduce = Number(data.get('rolls_to_unproduce'));
		const selectedDate = data.get('selected_date') || '';

		if (!Number.isInteger(runId) || runId < 1) {
			return fail(400, { error: 'Select a valid production run.' });
		}
		if (!Number.isInteger(rollsToUnproduce) || rollsToUnproduce < 1) {
			return fail(400, { error: 'Enter a valid roll count.' });
		}

		try {
			await unproduceRun(runId, rollsToUnproduce, locals.appUser.id);
		} catch (err) {
			return fail(500, { error: err.message });
		}

		redirect(
			303,
			selectedDate ? `/production/unproduce?date=${selectedDate}` : '/production/unproduce'
		);
	},
};
