import { db } from '$lib/db.js';
import { json } from '@sveltejs/kit';

export async function GET({ url }) {
	const year  = Number(url.searchParams.get('year')  || new Date().getFullYear());
	const month = Number(url.searchParams.get('month') || new Date().getMonth() + 1);

	const start = `${year}-${String(month).padStart(2, '0')}-01`;
	const end   = new Date(year, month, 0).toISOString().slice(0, 10); // last day of month

	const [poRows] = await db.query(
		`SELECT pol.id, po.po_number, po.expected_date AS event_date,
		        ms.display_label, pol.sqft_ordered,
		        'po' AS event_type
		 FROM purchase_order_lines pol
		 JOIN purchase_orders po ON po.id = pol.po_id
		 JOIN material_skus ms ON ms.id = pol.sku_id
		 WHERE po.expected_date BETWEEN ? AND ?
		   AND po.status = 'OPEN'
		 ORDER BY po.expected_date, po.po_number`, [start, end]
	);

	const [runRows] = await db.query(
		`SELECT pr.id, pr.run_number, pr.run_date AS event_date,
		        ms.display_label, pr.sqft_scheduled,
		        so.so_number, so.job_name,
		        'production' AS event_type
		 FROM production_runs pr
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 JOIN sales_order_lines sol ON sol.id = pr.so_line_id
		 JOIN sales_orders so ON so.id = sol.so_id
		 WHERE pr.run_date BETWEEN ? AND ?
		   AND pr.status IN ('SCHEDULED','CONFIRMED')
		 ORDER BY pr.run_date, pr.run_number`, [start, end]
	);

	// Group by date
	const byDate = {};
	for (const row of poRows) {
		const d = row.event_date.toISOString?.().slice(0, 10) ?? String(row.event_date).slice(0, 10);
		(byDate[d] ??= []).push({ type: 'po', label: `PO ${row.po_number} — ${row.display_label} ${Math.round(row.sqft_ordered).toLocaleString()} sqft` });
	}
	for (const row of runRows) {
		const d = row.event_date.toISOString?.().slice(0, 10) ?? String(row.event_date).slice(0, 10);
		(byDate[d] ??= []).push({ type: 'production', label: `${row.run_number} — ${row.display_label} ${Math.round(row.sqft_scheduled).toLocaleString()} sqft (${row.job_name})` });
	}

	return json(byDate);
}
