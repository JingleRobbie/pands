import { db } from '$lib/db.js';
import { json } from '@sveltejs/kit';
import { localDate } from '$lib/utils.js';

export async function GET({ url }) {
	const year = Number(url.searchParams.get('year') || new Date().getFullYear());
	const month = Number(url.searchParams.get('month') || new Date().getMonth() + 1);
	const status = url.searchParams.get('status') ?? '';

	const start = `${year}-${String(month).padStart(2, '0')}-01`;
	const end = localDate(new Date(year, month, 0)); // last day of month

	const [poRows] = await db.query(
		`SELECT po.id AS po_id, po.po_number, po.vendor_name, po.expected_date AS event_date
		 FROM purchase_order_lines pol
		 JOIN purchase_orders po ON po.id = pol.po_id
		 WHERE po.expected_date BETWEEN ? AND ?
		   AND po.status = 'OPEN'
		 ORDER BY po.expected_date, po.po_number`,
		[start, end]
	);

	let runStatusFilter;
	if (status === 'scheduled') {
		runStatusFilter = "AND pr.status = 'SCHEDULED'";
	} else if (status === 'completed') {
		runStatusFilter = "AND pr.status = 'COMPLETED'";
	} else {
		// default / all: any run with a date (UNSCHEDULED have no date so excluded by BETWEEN)
		runStatusFilter = "AND pr.status IN ('SCHEDULED','COMPLETED')";
	}

	const [runRows] = await db.query(
		`SELECT so.id AS so_id, pr.run_date AS event_date,
		        so.so_number, so.job_name, so.customer_name
		 FROM production_runs pr
		 JOIN sales_order_lines sol ON sol.id = pr.so_line_id
		 JOIN sales_orders so ON so.id = sol.so_id
		 WHERE pr.run_date BETWEEN ? AND ?
		   ${runStatusFilter}
		 ORDER BY pr.run_date`,
		[start, end]
	);

	// Group by date, keyed by entity id (po.id or so.id)
	const byDate = {};
	for (const row of poRows) {
		const d =
			row.event_date.toISOString?.().slice(0, 10) ?? String(row.event_date).slice(0, 10);
		(byDate[d] ??= {})[row.po_id] = {
			type: 'po',
			label: `${row.vendor_name} - ${row.po_number}`,
		};
	}
	for (const row of runRows) {
		const d =
			row.event_date.toISOString?.().slice(0, 10) ?? String(row.event_date).slice(0, 10);
		(byDate[d] ??= {})[row.so_id] = {
			type: 'production',
			label: `${row.so_number} ${row.customer_name} - ${row.job_name}`,
		};
	}

	return json(byDate);
}
