import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

function groupRunsBySo(runRows, today) {
	const map = new Map();
	for (const run of runRows) {
		if (!map.has(run.so_id)) {
			map.set(run.so_id, {
				so_id: run.so_id,
				so_number: run.so_number,
				job_name: run.job_name,
				customer_name: run.customer_name,
				runs: [],
			});
		}
		map.get(run.so_id).runs.push(run);
	}

	return [...map.values()]
		.map((so) => {
			const toISO = (d) =>
				d instanceof Date
					? d.toISOString().slice(0, 10)
					: d
						? String(d).slice(0, 10)
						: null;
			const dates = so.runs
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
			return { ...so, minDate, urgency };
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

export async function load({ url }) {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status') ?? '';

	const today = localDate();

	if (status === 'unscheduled') {
		const qWhere = q ? 'AND (so.so_number LIKE ? OR so.job_name LIKE ?)' : '';
		const qParams = q ? [`%${q}%`, `%${q}%`] : [];

		const [solRows] = await db.query(
			`SELECT so.id AS so_id, so.so_number, so.job_name, so.customer_name,
			        sol.id AS sol_id, ms.display_label, sol.facing,
			        (sol.sqft_ordered - sol.sqft_produced -
			         COALESCE(SUM(CASE WHEN pr.status != 'COMPLETED' THEN pr.sqft_scheduled ELSE 0 END), 0)) AS sqft_remaining
			 FROM sales_order_lines sol
			 JOIN sales_orders so ON so.id = sol.so_id
			 JOIN material_skus ms ON ms.id = sol.sku_id
			 LEFT JOIN production_runs pr ON pr.so_line_id = sol.id
			 WHERE so.status NOT IN ('COMPLETE', 'CANCELLED')
			 ${qWhere}
			 GROUP BY sol.id, so.id, so.so_number, so.job_name, so.customer_name, ms.display_label, sol.facing
			 HAVING sqft_remaining > 0
			 ORDER BY so.so_number, ms.sort_order`,
			qParams
		);

		const soMap = new Map();
		for (const row of solRows) {
			if (!soMap.has(row.so_id)) {
				soMap.set(row.so_id, {
					so_id: row.so_id,
					so_number: row.so_number,
					job_name: row.job_name,
					customer_name: row.customer_name,
					runs: [],
					minDate: null,
					urgency: 'unscheduled',
				});
			}
			soMap.get(row.so_id).runs.push({
				id: row.sol_id,
				display_label: row.display_label,
				facing: row.facing,
				sqft_scheduled: row.sqft_remaining,
				status: 'UNSCHEDULED',
			});
		}
		return { soGroups: [...soMap.values()], today, q, status };
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
		where.push('(pr.run_number LIKE ? OR so.job_name LIKE ? OR so.so_number LIKE ?)');
		params.push(`%${q}%`, `%${q}%`, `%${q}%`);
	}

	const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

	const [runRows] = await db.query(
		`SELECT pr.id, pr.run_number, pr.group_id, pr.run_date, pr.sqft_scheduled, pr.status,
		        ms.display_label, sol.facing,
		        so.id AS so_id, so.so_number, so.job_name, so.customer_name
		 FROM production_runs pr
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 JOIN sales_order_lines sol ON sol.id = pr.so_line_id
		 JOIN sales_orders so ON so.id = sol.so_id
		 ${whereClause}
		 ORDER BY so.id, pr.run_date IS NULL, pr.run_date, pr.run_number`,
		params
	);

	const soGroups = groupRunsBySo(runRows, today);
	return { soGroups, today, q, status };
}
