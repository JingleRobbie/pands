import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

function groupRunsByWo(runRows, today) {
	const map = new Map();
	for (const run of runRows) {
		if (!map.has(run.wo_id)) {
			map.set(run.wo_id, {
				wo_id: run.wo_id,
				so_number: run.so_number,
				job_name: run.job_name,
				customer_name: run.customer_name,
				runs: [],
			});
		}
		map.get(run.wo_id).runs.push(run);
	}

	return [...map.values()]
		.map((wo) => {
			const toISO = (d) =>
				d instanceof Date
					? d.toISOString().slice(0, 10)
					: d
						? String(d).slice(0, 10)
						: null;
			const dates = wo.runs
				.map((r) => toISO(r.run_date))
				.filter(Boolean)
				.sort();
			const minDate = dates[0] ?? null;
			const urgency = !minDate
				? 'unscheduled'
				: minDate < today
					? 'overdue'
					: minDate === today
						? 'today'
						: 'upcoming';
			return { ...wo, minDate, urgency };
		})
		.sort((a, b) => {
			const order = { overdue: 0, today: 1, upcoming: 2, unscheduled: 3 };
			if (order[a.urgency] !== order[b.urgency]) return order[a.urgency] - order[b.urgency];
			if (!a.minDate && !b.minDate) return 0;
			if (!a.minDate) return 1;
			if (!b.minDate) return -1;
			return a.minDate < b.minDate ? -1 : 1;
		});
}

export async function load({ url, locals }) {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status') ?? '';

	const today = localDate();

	if (status === 'unscheduled') {
		const qWhere = q ? 'AND (wo.so_number LIKE ? OR wo.job_name LIKE ?)' : '';
		const qParams = q ? [`%${q}%`, `%${q}%`] : [];

		const [wolRows] = await db.query(
			`SELECT wo.id AS wo_id, wo.so_number, wo.job_name, wo.customer_name,
			        wol.id AS wol_id, ms.display_label, wol.facing,
			        (wol.qty - wol.rolls_produced -
			         COALESCE(SUM(CASE WHEN pr.status != 'COMPLETED' THEN pr.rolls_scheduled ELSE 0 END), 0)) AS rolls_remaining
			 FROM work_order_lines wol
			 JOIN work_orders wo ON wo.id = wol.wo_id
			 JOIN material_skus ms ON ms.id = wol.sku_id
			 LEFT JOIN production_runs pr ON pr.wo_line_id = wol.id
			 WHERE wo.status NOT IN ('COMPLETE', 'CANCELLED')
			 ${qWhere}
			 GROUP BY wol.id, wo.id, wo.so_number, wo.job_name, wo.customer_name, ms.display_label, wol.facing
			 HAVING rolls_remaining > 0
			 ORDER BY wo.so_number, ms.sort_order`,
			qParams
		);

		const woMap = new Map();
		for (const row of wolRows) {
			if (!woMap.has(row.wo_id)) {
				woMap.set(row.wo_id, {
					wo_id: row.wo_id,
					so_number: row.so_number,
					job_name: row.job_name,
					customer_name: row.customer_name,
					runs: [],
					minDate: null,
					urgency: 'unscheduled',
				});
			}
			woMap.get(row.wo_id).runs.push({
				id: row.wol_id,
				display_label: row.display_label,
				facing: row.facing,
				rolls_scheduled: row.rolls_remaining,
				status: 'UNSCHEDULED',
			});
		}
		return { woGroups: [...woMap.values()], today, q, status, user: locals.appUser };
	}

	const where = [];
	const params = [];

	if (status === 'all') {
		// no status filter
	} else if (status) {
		where.push('pr.status = ?');
		params.push(status.toUpperCase());
	} else {
		where.push("pr.status != 'COMPLETED'");
	}

	if (q) {
		where.push('(pr.run_number LIKE ? OR wo.job_name LIKE ? OR wo.so_number LIKE ?)');
		params.push(`%${q}%`, `%${q}%`, `%${q}%`);
	}

	const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

	const [runRows] = await db.query(
		`SELECT pr.id, pr.run_number, pr.group_id, pr.run_date, pr.rolls_scheduled, pr.status,
		        ms.display_label, wol.facing,
		        wo.id AS wo_id, wo.so_number, wo.job_name, wo.customer_name
		 FROM production_runs pr
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		 JOIN work_orders wo ON wo.id = wol.wo_id
		 ${whereClause}
		 ORDER BY wo.id, pr.run_date IS NULL, pr.run_date, pr.run_number`,
		params
	);

	const woGroups = groupRunsByWo(runRows, today);
	return { woGroups, today, q, status, user: locals.appUser };
}
