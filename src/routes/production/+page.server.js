import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

const STATUS_ORDER = { UNSCHEDULED: 0, SCHEDULED: 1, COMPLETED: 2 };

function worstStatus(a, b) {
	return STATUS_ORDER[a] <= STATUS_ORDER[b] ? a : b;
}

function groupRunsByWo(runRows, today) {
	const toISO = (d) =>
		d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : null;

	const map = new Map();
	for (const run of runRows) {
		if (!map.has(run.wo_id)) {
			map.set(run.wo_id, {
				wo_id: run.wo_id,
				so_number: run.so_number,
				job_name: run.job_name,
				customer_name: run.customer_name,
				skuMap: new Map(),
				dates: [],
				first_pending_run_id: null,
			});
		}
		const wo = map.get(run.wo_id);
		if (run.run_date) wo.dates.push(run.run_date);
		if (!wo.first_pending_run_id && run.status !== 'COMPLETED') {
			wo.first_pending_run_id = run.id;
		}

		const key = `${run.display_label}|||${run.facing}`;
		if (!wo.skuMap.has(key)) {
			wo.skuMap.set(key, {
				display_label: run.display_label,
				facing: run.facing,
				total_rolls: 0,
				total_sqft: 0,
				status: 'COMPLETED',
			});
		}
		const sku = wo.skuMap.get(key);
		sku.total_rolls += Number(run.rolls_scheduled);
		sku.total_sqft += Number(run.sqft_scheduled || 0);
		sku.status = worstStatus(run.status, sku.status);
	}

	return [...map.values()]
		.map((wo) => {
			const dates = wo.dates.map(toISO).filter(Boolean).sort();
			const minDate = dates[0] ?? null;
			const urgency = !minDate
				? 'unscheduled'
				: minDate < today
					? 'overdue'
					: minDate === today
						? 'today'
						: 'upcoming';
			return {
				wo_id: wo.wo_id,
				so_number: wo.so_number,
				job_name: wo.job_name,
				customer_name: wo.customer_name,
				skuLines: [...wo.skuMap.values()],
				first_pending_run_id: wo.first_pending_run_id,
				minDate,
				urgency,
			};
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
		`SELECT pr.id, pr.run_number, pr.group_id, pr.run_date, pr.rolls_scheduled, pr.sqft_scheduled, pr.status,
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
